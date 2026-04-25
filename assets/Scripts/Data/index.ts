/**
 * 数据系统统一入口
 *
 * 使用方式：
 * ```ts
 * import { DataManager, CocosDataProvider, TextManager, TextId } from './Data';
 *
 * // 加载
 * await DataManager.getInstance().load(new CocosDataProvider());
 *
 * // 访问配置表
 * const tables = DataManager.getInstance().tables;
 *
 * // 获取本地化文本（推荐使用枚举）
 * TextManager.getInstance().getText(TextId.Score);
 * ```
 */

export { DataManager } from './DataManager';
export { TextManager } from './TextManager';
export { TextId } from './TextId';
export type { LoadProgressCallback } from './DataManager';
export type { Language } from './TextManager';
export type { IDataProvider } from './IDataProvider';
export { CocosDataProvider } from './CocosDataProvider';
