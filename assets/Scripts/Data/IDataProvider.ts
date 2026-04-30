/**
 * 数据提供者抽象接口
 *
 * 将数据加载方式与数据管理器解耦。
 * 不同引擎/运行环境只需实现此接口即可接入项目的二进制配置系统。
 *
 * 使用方式：
 * ```ts
 * // Cocos Creator 环境
 * const provider = new CocosDataProvider();
 *
 * // 自定义环境（如 Node.js 测试）
 * const provider: IDataProvider = {
 *     loadFileNames: () => Tables.getTableNames(),
 *     loadBinary: (fileName) => fs.readFileSync(`data/${fileName}.bin`),
 * };
 * ```
 */

import ByteBuf from './luban/ByteBuf';

export interface IDataProvider {
    /**
     * 获取所有需要加载的配置文件名列表
    * 通常来自生成后的 Tables.getTableNames()
     */
    loadFileNames(): string[];

    /**
     * 加载指定文件的二进制数据
     *
     * @param fileName 配置文件名（不含扩展名，如 "item_tbitem"）
     * @returns Promise<ByteBuf> 文件的二进制数据
     */
    loadBinary(fileName: string): Promise<ByteBuf>;
}
