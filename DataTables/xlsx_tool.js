#!/usr/bin/env node
/**
 * Luban Excel 表管理工具 — Agent CLI
 *
 * 供 AI Agent 快捷增删查改 Luban 配置表。
 * 定义文件用 XML 格式（Defines/*.xml），数据文件用 xlsx 格式（Datas/*.xlsx）。
 * 所有输出均为 JSON 格式，方便 Agent 解析。
 *
 * 用法:
 *   node xlsx_tool.js <command> [args...]
 *
 * 命令:
 *   list                                    列出所有表
 *   schema <table>                          查看表结构
 *   select <table> [id]                     查询记录（省略 id 则返回全部）
 *   insert <table> '<json>'                 插入记录
 *   update <table> <id> '<json>'            更新记录（按主键 id）
 *   delete <table> <id>                     删除记录（按主键 id）
 *   add-column <table> <name> <type> [comment]  添加字段
 *   add-table <name> '<fields_json>' [index] [input] [comment]  新增表
 *   remove-table <name>                     删除表
 */

'use strict';

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const DATA_DIR = path.join(__dirname, 'Datas');
const DEFINES_DIR = path.join(__dirname, 'Defines');

// ─── Helpers ──────────────────────────────────────────────

function output(ok, data) {
    process.stdout.write(JSON.stringify({ ok, ...data }) + '\n');
}

function die(msg) {
    output(false, { error: msg });
    process.exit(1);
}

function parseArgs() {
    return process.argv.slice(2);
}

/** 读取 xlsx 行数据（跳过 1-indexed 偏移） */
function getRowValues(row) {
    return row.values.slice(1);
}

/** 从数据行中提取字段（跳过 A 列的 ##var/##type/##comment 标记，从 B 列开始） */
function extractFields(vals) {
    return vals.slice(1).filter(v => v !== undefined && v !== null && v !== '');
}

// ─── XML Definition Parsing ───────────────────────────────

/** 从 Defines/*.xml 读取所有表定义 */
function loadTableRegistry() {
    const tables = [];

    if (!fs.existsSync(DEFINES_DIR)) return tables;

    const files = fs.readdirSync(DEFINES_DIR).filter(f => f.endsWith('.xml'));
    for (const file of files) {
        const content = fs.readFileSync(path.join(DEFINES_DIR, file), 'utf-8');
        // Parse <table> elements
        const tableRegex = /<table\s+([^>]+)\/?>/g;
        let match;
        while ((match = tableRegex.exec(content)) !== null) {
            const attrs = parseXmlAttrs(match[1]);
            tables.push({
                name: attrs.name || '',
                value: attrs.value || '',
                index: attrs.index || '',
                input: attrs.input || '',
                comment: attrs.comment || '',
                sourceFile: file
            });
        }
    }

    return tables;
}

/** 解析 XML 属性字符串为对象 */
function parseXmlAttrs(attrStr) {
    const result = {};
    const regex = /(\w+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = regex.exec(attrStr)) !== null) {
        result[m[1]] = m[2];
    }
    return result;
}

/** 获取指定表的 bean 定义（字段列表） */
function getBeanFields(tableName) {
    const registry = loadTableRegistry();
    const entry = registry.find(t => t.name === tableName);
    if (!entry) return null;

    const xmlPath = path.join(DEFINES_DIR, entry.sourceFile);
    const content = fs.readFileSync(xmlPath, 'utf-8');

    // Find the <bean> that matches the table's value
    const beanRegex = /<bean\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/bean>/g;
    let beanMatch;
    while ((beanMatch = beanRegex.exec(content)) !== null) {
        if (beanMatch[1] === entry.value) {
            const beanBody = beanMatch[2];
            const fields = [];
            const varRegex = /<var\s+([^/]+)\/>/g;
            let varMatch;
            while ((varMatch = varRegex.exec(beanBody)) !== null) {
                const attrs = parseXmlAttrs(varMatch[1]);
                fields.push({
                    name: attrs.name || '',
                    type: attrs.type || '',
                    comment: attrs.comment || ''
                });
            }
            return fields;
        }
    }

    return null;
}

// ─── Schema ───────────────────────────────────────────────

/** 获取表的 schema 信息（综合 XML 定义 + 数据 xlsx 头） */
async function getTableSchema(tableName) {
    const registry = loadTableRegistry();
    const entry = registry.find(t => t.name === tableName);
    if (!entry) return null;

    const fields = getBeanFields(tableName) || [];
    let recordCount = 0;
    try {
        const { records } = await readTableData(tableName);
        recordCount = records.length;
    } catch { /* ignore */ }

    return {
        tableName,
        value: entry.value,
        index: entry.index || (fields.length > 0 ? fields[0].name : ''),
        input: entry.input,
        comment: entry.comment,
        group: 'c',
        recordCount,
        fields
    };
}

// ─── Data CRUD ────────────────────────────────────────────

/** 从数据 xlsx 头行获取字段列表 */
function getFieldsFromXlsx(ws) {
    return extractFields(getRowValues(ws.getRow(1)));
}

/** 读取表全部数据 */
async function readTableData(tableName) {
    const registry = loadTableRegistry();
    const entry = registry.find(t => t.name === tableName);
    if (!entry) die(`table "${tableName}" not found in registry`);

    const dataFileName = entry.input.replace(/\.xlsx$/i, '') || tableName.charAt(0).toLowerCase() + tableName.slice(1);
    const dataPath = path.join(DATA_DIR, `${dataFileName}.xlsx`);
    if (!fs.existsSync(dataPath)) die(`data file not found: ${dataPath}`);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(dataPath);
    const ws = wb.worksheets[0];

    const fields = getFieldsFromXlsx(ws);
    const types = extractFields(getRowValues(ws.getRow(2)));

    const records = [];
    ws.eachRow((row, rowNumber) => {
        if (rowNumber <= 3) return; // skip ##var, ##type, ##comment
        const vals = getRowValues(row);
        if (!vals[0] && vals.every(v => v === undefined || v === null || v === '')) return;

        // A 列是行注释列，跳过。数据从 B 列开始（index 1）
        const dataVals = vals.slice(1);
        const record = {};
        fields.forEach((field, i) => {
            let val = dataVals[i];
            if (val !== undefined && val !== null) {
                if (types[i] === 'int' || types[i] === 'long') {
                    val = typeof val === 'number' ? Math.round(val) : val;
                }
            }
            record[field] = val;
        });
        records.push(record);
    });

    return { fields, types, records, dataPath, entry };
}

/** 将记录写回数据表 xlsx */
async function writeTableData(dataPath, fields, records) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(dataPath);
    const ws = wb.worksheets[0];

    // Clear data rows (row 4+)
    const rowCount = ws.rowCount;
    for (let r = rowCount; r >= 4; r--) {
        ws.spliceRows(r, 1);
    }

    // Write records — A 列为空（行注释列），数据从 B 列开始
    for (const record of records) {
        const rowVals = ['', ...fields.map(f => record[f] ?? '')];
        ws.addRow(rowVals);
    }

    await wb.xlsx.writeFile(dataPath);
}

// ─── Commands ─────────────────────────────────────────────

async function cmdList() {
    const registry = loadTableRegistry();
    const result = [];
    for (const t of registry) {
        let recordCount = 0;
        try {
            const { records } = await readTableData(t.name);
            recordCount = records.length;
        } catch { /* ignore */ }
        result.push({ ...t, recordCount });
    }
    output(true, { tables: result });
}

async function cmdSchema(tableName) {
    const schema = await getTableSchema(tableName);
    if (!schema) die(`table "${tableName}" not found`);
    output(true, { schema });
}

async function cmdSelect(tableName, id) {
    const { records, fields } = await readTableData(tableName);
    const schema = await getTableSchema(tableName);
    const indexField = schema?.index || 'Id';

    let result = records;
    if (id !== undefined) {
        const idVal = isNaN(Number(id)) ? id : Number(id);
        result = records.filter(r => r[indexField] === idVal);
    }

    output(true, { count: result.length, fields, records: result });
}

async function cmdInsert(tableName, jsonStr) {
    let newRecord;
    try {
        newRecord = JSON.parse(jsonStr);
    } catch {
        die(`invalid JSON: ${jsonStr}`);
    }

    const { records, dataPath, fields } = await readTableData(tableName);
    const schema = await getTableSchema(tableName);
    const indexField = schema?.index || 'Id';

    if (newRecord[indexField] !== undefined) {
        const idVal = typeof newRecord[indexField] === 'string' && !isNaN(Number(newRecord[indexField]))
            ? Number(newRecord[indexField]) : newRecord[indexField];
        const dup = records.find(r => r[indexField] === idVal);
        if (dup) die(`duplicate ${indexField}: ${newRecord[indexField]}`);
    }

    records.push(newRecord);
    await writeTableData(dataPath, fields, records);
    output(true, { inserted: newRecord });
}

async function cmdUpdate(tableName, id, jsonStr) {
    let updates;
    try {
        updates = JSON.parse(jsonStr);
    } catch {
        die(`invalid JSON: ${jsonStr}`);
    }

    const { records, dataPath, fields } = await readTableData(tableName);
    const schema = await getTableSchema(tableName);
    const indexField = schema?.index || 'Id';
    const idVal = isNaN(Number(id)) ? id : Number(id);

    const idx = records.findIndex(r => r[indexField] === idVal);
    if (idx === -1) die(`record with ${indexField}=${id} not found`);

    delete updates[indexField];
    Object.assign(records[idx], updates);
    await writeTableData(dataPath, fields, records);
    output(true, { updated: records[idx] });
}

async function cmdDelete(tableName, id) {
    const { records, dataPath, fields } = await readTableData(tableName);
    const schema = await getTableSchema(tableName);
    const indexField = schema?.index || 'Id';
    const idVal = isNaN(Number(id)) ? id : Number(id);

    const idx = records.findIndex(r => r[indexField] === idVal);
    if (idx === -1) die(`record with ${indexField}=${id} not found`);

    const deleted = records.splice(idx, 1)[0];
    await writeTableData(dataPath, fields, records);
    output(true, { deleted });
}

async function cmdAddColumn(tableName, colName, colType, colComment) {
    const registry = loadTableRegistry();
    const entry = registry.find(t => t.name === tableName);
    if (!entry) die(`table "${tableName}" not found`);

    // 1. Update XML definition — add <var> to the matching <bean>
    const xmlPath = path.join(DEFINES_DIR, entry.sourceFile);
    let content = fs.readFileSync(xmlPath, 'utf-8');

    // Find the bean and add a <var> before </bean>
    const beanCloseRegex = new RegExp(`(<bean\\s+name="${entry.value}"[^>]*>[\\s\\S]*?)(</bean>)`, 'g');
    let found = false;
    content = content.replace(beanCloseRegex, (match, beanOpen, closeTag) => {
        found = true;
        const indent = '\n        ';
        const newVar = `${indent}<var name="${colName}" type="${colType}"${colComment ? ` comment="${colComment}"` : ''}/>`;
        return beanOpen + newVar + '\n    ' + closeTag;
    });

    if (!found) die(`bean "${entry.value}" not found in ${entry.sourceFile}`);
    fs.writeFileSync(xmlPath, content, 'utf-8');

    // 2. Update data xlsx — add column to header rows
    const dataFileName = entry.input.replace(/\.xlsx$/i, '');
    const dataPath = path.join(DATA_DIR, `${dataFileName}.xlsx`);

    if (fs.existsSync(dataPath)) {
        const dataWb = new ExcelJS.Workbook();
        await dataWb.xlsx.readFile(dataPath);
        const dataWs = dataWb.worksheets[0];

        // Add column to ##var, ##type, ##comment rows
        const headerColCount = dataWs.getRow(1).cellCount;
        dataWs.getRow(1).getCell(headerColCount + 1).value = colName;
        dataWs.getRow(2).getCell(headerColCount + 1).value = colType;
        dataWs.getRow(3).getCell(headerColCount + 1).value = colComment || '';

        await dataWb.xlsx.writeFile(dataPath);
    }

    output(true, { addedColumn: { table: tableName, name: colName, type: colType, comment: colComment || '' } });
}

async function cmdAddTable(name, fieldsJson, index, input, comment) {
    let fields;
    try {
        fields = JSON.parse(fieldsJson);
    } catch {
        die(`invalid JSON: ${fieldsJson}`);
    }
    if (!Array.isArray(fields) || fields.length === 0) die('fields must be a non-empty array of {name, type, comment?}');

    const indexField = index || fields[0].name;
    const inputFile = (input || name.charAt(0).toLowerCase() + name.slice(1)) + '.xlsx';
    const valueName = name.replace(/^Tb/, '');
    const commentStr = comment || '';

    // Derive module name from table name (lowercase without Tb prefix)
    const moduleName = valueName.toLowerCase();

    // 1. Create XML definition file
    const xmlPath = path.join(DEFINES_DIR, `${moduleName}.xml`);
    if (fs.existsSync(xmlPath)) die(`definition file already exists: ${moduleName}.xml`);

    const varLines = fields.map(f =>
        `        <var name="${f.name}" type="${f.type}"${f.comment ? ` comment="${f.comment}"` : ''}/>`
    ).join('\n');

    const xmlContent = `<module name="${moduleName}">

    <bean name="${valueName}">
${varLines}
    </bean>

    <table name="${name}" value="${valueName}" index="${indexField}" input="${inputFile}"${commentStr ? ` comment="${commentStr}"` : ''}/>

</module>
`;
    fs.writeFileSync(xmlPath, xmlContent, 'utf-8');

    // 2. Create data xlsx
    const dataPath = path.join(DATA_DIR, inputFile);
    const dataWb = new ExcelJS.Workbook();
    const dataWs = dataWb.addWorksheet(valueName);
    // A 列为行注释列，数据从 B 列开始
    dataWs.addRow(['##var', ...fields.map(f => f.name)]);
    dataWs.addRow(['##type', ...fields.map(f => f.type)]);
    dataWs.addRow(['##comment', ...fields.map(f => f.comment || '')]);
    await dataWb.xlsx.writeFile(dataPath);

    output(true, { addedTable: { name, value: valueName, index: indexField, input: inputFile, comment: commentStr, fields } });
}

async function cmdRemoveTable(name) {
    const registry = loadTableRegistry();
    const entry = registry.find(t => t.name === name);
    if (!entry) die(`table "${name}" not found`);

    // 1. Delete XML definition file
    const xmlPath = path.join(DEFINES_DIR, entry.sourceFile);
    if (fs.existsSync(xmlPath)) {
        fs.unlinkSync(xmlPath);
    }

    // 2. Delete data xlsx
    const dataFileName = entry.input.replace(/\.xlsx$/i, '');
    const dataPath = path.join(DATA_DIR, `${dataFileName}.xlsx`);
    if (fs.existsSync(dataPath)) {
        fs.unlinkSync(dataPath);
    }

    output(true, { removedTable: name });
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
    const args = parseArgs();
    if (args.length === 0) die('no command. Available: list, schema, select, insert, update, delete, add-column, add-table, remove-table');

    const cmd = args[0];

    switch (cmd) {
        case 'list':
            await cmdList();
            break;
        case 'schema':
            if (!args[1]) die('usage: schema <table>');
            await cmdSchema(args[1]);
            break;
        case 'select':
            if (!args[1]) die('usage: select <table> [id]');
            await cmdSelect(args[1], args[2]);
            break;
        case 'insert':
            if (!args[1] || !args[2]) die('usage: insert <table> \'<json>\'');
            await cmdInsert(args[1], args[2]);
            break;
        case 'update':
            if (!args[1] || !args[2] || !args[3]) die('usage: update <table> <id> \'<json>\'');
            await cmdUpdate(args[1], args[2], args[3]);
            break;
        case 'delete':
            if (!args[1] || !args[2]) die('usage: delete <table> <id>');
            await cmdDelete(args[1], args[2]);
            break;
        case 'add-column':
            if (!args[1] || !args[2] || !args[3]) die('usage: add-column <table> <name> <type> [comment]');
            await cmdAddColumn(args[1], args[2], args[3], args[4]);
            break;
        case 'add-table':
            if (!args[1] || !args[2]) die('usage: add-table <name> \'<fields_json>\' [index] [input] [comment]');
            await cmdAddTable(args[1], args[2], args[3], args[4], args[5]);
            break;
        case 'remove-table':
            if (!args[1]) die('usage: remove-table <name>');
            await cmdRemoveTable(args[1]);
            break;
        default:
            die(`unknown command: ${cmd}. Available: list, schema, select, insert, update, delete, add-column, add-table, remove-table`);
    }
}

main().catch(err => {
    output(false, { error: err.message });
    process.exit(1);
});
