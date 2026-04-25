#!/usr/bin/env node
/**
 * 文本枚举生成脚本
 *
 * 从 TbText 表的 xlsx 数据中读取 Id、EnumName、ZhCn，
 * 生成 TypeScript 枚举文件 TextId.ts，用中文文本作为注释。
 *
 * 用法: node gen_text_enum.js
 *
 * 枚举名称来自 EnumName 列，如果 EnumName 为空则跳过该行。
 * 生成文件路径: assets/Scripts/Data/TextId.ts
 */

'use strict';

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const DATA_DIR = path.join(__dirname, 'Datas');
const DEFINES_DIR = path.join(__dirname, 'Defines');
const OUTPUT_PATH = path.join(__dirname, '..', 'assets', 'Scripts', 'Data', 'TextId.ts');

// ─── Helpers ──────────────────────────────────────────────

/** 从数据行中提取字段（跳过 A 列标记，从 B 列开始） */
function extractFields(vals) {
    return vals.slice(1).filter(v => v !== undefined && v !== null && v !== '');
}

/** 读取 xlsx 行数据（跳过 1-indexed 偏移） */
function getRowValues(row) {
    return row.values.slice(1);
}

/** 读取 Defines XML 获取数据文件名 */
function getDataFileName() {
    const xmlPath = path.join(DEFINES_DIR, 'text.xml');
    const content = fs.readFileSync(xmlPath, 'utf-8');
    const match = content.match(/<table[^>]+input="([^"]+)"[^>]*>/);
    return match ? match[1] : 'text.xlsx';
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
    const dataFileName = getDataFileName();
    const dataPath = path.join(DATA_DIR, dataFileName);

    if (!fs.existsSync(dataPath)) {
        console.error(`[gen_text_enum] data file not found: ${dataPath}`);
        process.exit(1);
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(dataPath);
    const ws = wb.worksheets[0];

    // 从 xlsx 头行获取字段列表
    const fields = extractFields(getRowValues(ws.getRow(1)));
    const idIdx = fields.indexOf('Id');
    const enumNameIdx = fields.indexOf('EnumName');
    const zhCnIdx = fields.indexOf('ZhCn');

    if (idIdx === -1 || enumNameIdx === -1 || zhCnIdx === -1) {
        console.error('[gen_text_enum] xlsx must have Id, EnumName, ZhCn columns');
        process.exit(1);
    }

    // 读取数据行
    const entries = [];
    ws.eachRow((row, rowNumber) => {
        if (rowNumber <= 3) return; // skip ##var, ##type, ##comment
        const vals = getRowValues(row);
        // 数据从 B 列开始（index 1），所以 field index + 1
        const id = vals[idIdx + 1];
        const enumName = vals[enumNameIdx + 1];
        const zhCn = vals[zhCnIdx + 1];

        if (!enumName || String(enumName).trim() === '') return;

        entries.push({
            id: typeof id === 'number' ? id : parseInt(id, 10),
            enumName: String(enumName).trim(),
            zhCn: String(zhCn || '').trim(),
        });
    });

    if (entries.length === 0) {
        console.warn('[gen_text_enum] no entries with EnumName found, skipping');
        return;
    }

    // 生成枚举代码
    const lines = [];
    lines.push('/**');
    lines.push(' * 文本 ID 枚举（自动生成，请勿手动修改）');
    lines.push(' *');
    lines.push(` * 生成时间: ${new Date().toISOString()}`);
    lines.push(` * 数据来源: ${dataFileName}`);
    lines.push(' */');
    lines.push('export enum TextId {');

    for (const entry of entries) {
        // 注释中的特殊字符转义
        const comment = entry.zhCn.replace(/\*\//g, '*\\/');
        lines.push(`    /** ${comment} */`);
        lines.push(`    ${entry.enumName} = ${entry.id},`);
        lines.push('');
    }

    // 移除最后一个多余空行
    lines.pop();
    lines.push('}');
    lines.push('');

    const content = lines.join('\n');

    // 确保输出目录存在
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, content, 'utf-8');
    console.log(`[gen_text_enum] generated: ${OUTPUT_PATH} (${entries.length} entries)`);
}

main().catch(err => {
    console.error('[gen_text_enum] Error:', err);
    process.exit(1);
});
