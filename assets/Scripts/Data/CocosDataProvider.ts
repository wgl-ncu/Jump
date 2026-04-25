/**
 * Cocos Creator 数据提供者实现
 *
 * 使用 Cocos Creator 的 resources 系统加载 Luban 生成的二进制配置文件。
 * 配置文件放置在 assets/resources/LubanData/ 目录下。
 */

import { resources, BufferAsset } from 'cc';
import ByteBuf from './luban/ByteBuf';
import { IDataProvider } from './IDataProvider';
import { Tables } from './schema/schema';

/** Luban 二进制数据文件在 resources 下的子目录 */
const LUBAN_DATA_PATH = 'LubanData';

export class CocosDataProvider implements IDataProvider {
    constructor() {}

    loadFileNames(): string[] {
        return Tables.getTableNames() as string[];
    }

    async loadBinary(fileName: string): Promise<ByteBuf> {
        const fullPath = `${LUBAN_DATA_PATH}/${fileName}`;
        return new Promise<ByteBuf>((resolve, reject) => {
            resources.load(fullPath, BufferAsset, (err, asset) => {
                if (err) {
                    reject(new Error(`[CocosDataProvider] load failed: ${fileName}, error: ${err.message}`));
                    return;
                }
                if (!asset) {
                    reject(new Error(`[CocosDataProvider] load returned null: ${fileName}`));
                    return;
                }
                const buffer = asset.buffer();
                const bytes = new Uint8Array(buffer.slice(0, buffer.byteLength));
                resolve(new ByteBuf(bytes));
            });
        });
    }
}
