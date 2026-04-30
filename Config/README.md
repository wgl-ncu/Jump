# Config Workflow

本项目的配置真源已经切换为 `Config/` 目录下的文本文件，旧的 `DataTables/` 与 `Tools/Luban/` 已经下线移除。

## 目录说明

- `Config/schema/tables.js`
  - 定义表名、主键、字段类型、输出文件名。
- `Config/data/*.js`
  - 每张表一份文本数据，默认使用“主键 -> 记录内容”的对象结构。
- `Tools/config/build-config.js`
  - 读取 schema 与文本数据，生成运行时使用的二进制和 TypeScript 代码。

## 日常流程

1. 直接修改 `Config/data/*.js`。
2. 如需新增字段或新表，先修改 `Config/schema/tables.js`。
3. 运行 `npm run build:config`。
4. 产物会自动写入：
   - `assets/resources/LubanData/*.bin`
   - `assets/Scripts/Data/schema/schema.ts`
   - `assets/Scripts/Data/TextId.ts`

## 当前约束

- 当前构建器支持的字段类型：`int`、`bool`、`float`、`double`、`string`。
- `runtime: false` 的字段不会写入二进制，可用于编辑期辅助信息，例如 `TbText.EnumName`。
- 二进制输出目录暂时继续复用 `assets/resources/LubanData`，只是沿用旧资源路径名，运行时加载逻辑无需改动。

## 给 Agent 的维护建议

- 优先直接编辑 `Config/data/*.js`，旧 Excel 配表链路已经不存在。
- 不要手改 `assets/Scripts/Data/schema/schema.ts` 和 `assets/Scripts/Data/TextId.ts`，它们会被重新生成。
- 修改配置后，始终重新运行一次 `npm run build:config`。