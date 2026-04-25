/**
 * Luban Excel 配置生成脚本
 *
 * 生成 Luban 所需的 xlsx 定义文件和数据文件。
 * 运行一次后，后续可直接用 Excel 编辑这些文件。
 *
 * 用法: node gen_xlsx.js
 */

const path = require('path');
const ExcelJS = require('exceljs');

const BASE_DIR = path.dirname(__filename);

async function saveWb(wb, relPath) {
    const fullPath = path.join(BASE_DIR, relPath);
    await wb.xlsx.writeFile(fullPath);
    console.log(`  created: ${relPath}`);
}

async function genTables() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('tables');

    // Luban 表注册格式
    ws.addRow(['##var',     'name',   'value',  'index', 'input', 'group']);
    ws.addRow(['##type',    'string', 'string', 'string','string','string']);
    ws.addRow(['##comment', '表名',   '类型',   '主键',  '数据文件','分组']);
    ws.addRow(['TbText',    'Text',   'Id',     'text',  'c']);

    await saveWb(wb, 'Defines/__tables__.xlsx');
}

async function genBeans() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('beans');

    // Text bean
    ws.addRow(['##var',     'Id',    'ZhCn']);
    ws.addRow(['##type',    'int',   'string']);
    ws.addRow(['##comment', 'ID',    '中文文本']);
    ws.addRow([]);  // 空行分隔

    await saveWb(wb, 'Defines/__beans__.xlsx');
}

async function genEnums() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('enums');

    ws.addRow(['##var',     'name',   'value']);
    ws.addRow(['##type',    'string', 'int']);

    await saveWb(wb, 'Defines/__enums__.xlsx');
}

async function genTextData() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Text');

    ws.addRow(['##var',     'Id',    'ZhCn']);
    ws.addRow(['##type',    'int',   'string']);
    ws.addRow(['##comment', 'ID',    '中文文本']);
    ws.addRow([1,  '确认']);
    ws.addRow([2,  '取消']);
    ws.addRow([3,  '返回']);
    ws.addRow([1001, '得分']);
    ws.addRow([1002, '最高分']);
    ws.addRow([1003, '重新开始']);
    ws.addRow([1004, '游戏结束']);
    ws.addRow([2001, '加载中...']);

    await saveWb(wb, 'Datas/text.xlsx');
}

async function main() {
    console.log('[Luban] Generating xlsx files...');
    await genTables();
    await genBeans();
    await genEnums();
    await genTextData();
    console.log('[Luban] Done! You can now edit these xlsx files in Excel.');
}

main().catch(err => {
    console.error('[Luban] Error:', err);
    process.exit(1);
});
