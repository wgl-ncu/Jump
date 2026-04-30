/**
 * 数据管理器
 *
 * 核心职责：
 * 1. 隐藏配置加载细节，业务层只需访问 DataManager.getInstance().tables
 * 2. 通过 IDataProvider 抽象数据加载方式，适配不同运行环境
 * 3. 提供异步加载 API，支持加载进度回调
 * 4. 加载完成后自动初始化 TextManager
 * 5. 单例模式，全局唯一
 *
 * 快速上手：
 * ```ts
 * // 1. 游戏启动时加载配置
 * await DataManager.getInstance().load(new CocosDataProvider());
 *
 * // 2. 业务层访问配置（无需关心加载细节）
 * const item = DataManager.getInstance().tables.TbItem.get(itemId);
 *
 * // 3. 获取本地化文本（通过 TextManager）
 * const text = TextManager.getInstance().getText(1001); // → "得分"
 * ```
 */

import ByteBuf from './luban/ByteBuf';
import { IDataProvider } from './IDataProvider';
import { TextManager } from './TextManager';
import { Tables } from './schema/schema';

/** 加载进度回调 */
export type LoadProgressCallback = (loaded: number, total: number, fileName: string) => void;

export class DataManager {
    private static _instance: DataManager | null = null;

    /** 生成的 Tables 实例，加载完成后可用 */
    private _tables: any = null;

    /** 是否已完成加载 */
    private _loaded = false;

    /** 当前使用的 IDataProvider */
    private _provider: IDataProvider | null = null;

    /** 已加载的原始数据缓存 */
    private _dataCache: Map<string, ByteBuf> = new Map();

    private constructor() {}

    /** 获取单例 */
    static getInstance(): DataManager {
        if (!DataManager._instance) {
            DataManager._instance = new DataManager();
        }
        return DataManager._instance;
    }

    /** 销毁单例（通常只在测试中使用） */
    static destroyInstance(): void {
        if (DataManager._instance) {
            DataManager._instance.reset();
            DataManager._instance = null;
        }
    }

    /** 获取配置表集合（加载完成后使用） */
    get tables(): any {
        if (!this._loaded || !this._tables) {
            console.warn('[DataManager] tables accessed before loading completed');
        }
        return this._tables;
    }

    /** 是否已完成加载 */
    get isLoaded(): boolean {
        return this._loaded;
    }

    /**
     * 异步加载所有配置数据
     *
     * @param provider 数据提供者，如 CocosDataProvider
     * @param onProgress 可选的加载进度回调
     * @returns Promise<void>
     *
     * 此方法会：
     * 1. 通过 provider 获取所有配置文件名
     * 2. 逐个加载二进制数据并缓存
     * 3. 创建 cfg.Tables 实例并完成反序列化
     *
     * 重复调用会先重置之前的数据。
     */
    async load(provider: IDataProvider, onProgress?: LoadProgressCallback): Promise<void> {
        this.reset();
        this._provider = provider;

        const fileNames = provider.loadFileNames();
        const total = fileNames.length;
        let loaded = 0;

        // 并发加载所有配置文件
        const loadPromises = fileNames.map(async (fileName) => {
            try {
                const byteBuf = await provider.loadBinary(fileName);
                this._dataCache.set(fileName, byteBuf);
                loaded++;
                onProgress?.(loaded, total, fileName);
            } catch (err) {
                console.error(`[DataManager] failed to load: ${fileName}`, err);
                throw err;
            }
        });

        await Promise.all(loadPromises);

        // 创建 Tables 实例
        this._tables = new Tables((fileName: string) => {
            return this._dataCache.get(fileName) ?? null;
        });

        this._loaded = true;

        // 初始化 TextManager
        if (this._tables?.TbText) {
            TextManager.getInstance().init(this._tables.TbText);
        }

        console.log(`[DataManager] all ${total} config files loaded`);
    }

    /**
     * 热更新：重新加载指定配置
     *
     * @param fileNames 需要重新加载的文件名列表
     */
    async reload(fileNames: string[]): Promise<void> {
        if (!this._provider) {
            console.error('[DataManager] cannot reload: no provider set');
            return;
        }

        for (const fileName of fileNames) {
            try {
                const byteBuf = await this._provider.loadBinary(fileName);
                this._dataCache.set(fileName, byteBuf);
                console.log(`[DataManager] reloaded: ${fileName}`);
            } catch (err) {
                console.error(`[DataManager] failed to reload: ${fileName}`, err);
            }
        }

        // 重建 Tables
        this._tables = new Tables((fileName: string) => {
            return this._dataCache.get(fileName) ?? null;
        });
    }

    /** 重置所有数据 */
    reset(): void {
        this._tables = null;
        this._loaded = false;
        this._dataCache.clear();
        TextManager.getInstance().reset();
    }
}
