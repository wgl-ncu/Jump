'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..', '..');
const SCHEMA_DEFINITION_PATH = path.join(ROOT_DIR, 'Config', 'schema', 'tables.js');
const DATA_DIR = path.join(ROOT_DIR, 'Config', 'data');
const OUTPUT_SCHEMA_PATH = path.join(ROOT_DIR, 'assets', 'Scripts', 'Data', 'schema', 'schema.ts');
const OUTPUT_TEXT_ID_PATH = path.join(ROOT_DIR, 'assets', 'Scripts', 'Data', 'TextId.ts');
const OUTPUT_BIN_DIR = path.join(ROOT_DIR, 'assets', 'resources', 'LubanData');

const TYPE_READERS = {
    bool: 'readBool',
    int: 'readInt',
    float: 'readFloat',
    double: 'readDouble',
    string: 'readString',
};

const TYPE_TS = {
    bool: 'boolean',
    int: 'number',
    float: 'number',
    double: 'number',
    string: 'string',
};

class ByteWriter {
    constructor() {
        this._chunks = [];
    }

    writeBool(value) {
        this._chunks.push(Buffer.from([value ? 1 : 0]));
    }

    writeInt(value) {
        if (!Number.isInteger(value)) {
            throw new Error(`int value expected, got ${value}`);
        }

        if (value >= 0 && value < 0x80) {
            this._chunks.push(Buffer.from([value]));
            return;
        }

        if (value >= 0 && value < 0x4000) {
            const encoded = value | 0x8000;
            const buf = Buffer.allocUnsafe(2);
            buf.writeUInt16BE(encoded, 0);
            this._chunks.push(buf);
            return;
        }

        if (value >= 0 && value < 0x200000) {
            const buf = Buffer.allocUnsafe(3);
            buf[0] = 0xc0 | ((value >> 16) & 0x1f);
            buf.writeUInt16BE(value & 0xffff, 1);
            this._chunks.push(buf);
            return;
        }

        if (value >= 0 && value < 0x10000000) {
            const encoded = value | 0xe0000000;
            const buf = Buffer.allocUnsafe(4);
            buf.writeUInt32BE(encoded >>> 0, 0);
            this._chunks.push(buf);
            return;
        }

        const buf = Buffer.allocUnsafe(5);
        buf[0] = 0xf0;
        buf.writeInt32BE(value, 1);
        this._chunks.push(buf);
    }

    writeFloat(value) {
        const buf = Buffer.allocUnsafe(4);
        buf.writeFloatLE(value, 0);
        this._chunks.push(buf);
    }

    writeDouble(value) {
        const buf = Buffer.allocUnsafe(8);
        buf.writeDoubleLE(value, 0);
        this._chunks.push(buf);
    }

    writeString(value) {
        const text = value ?? '';
        const bytes = Buffer.from(String(text), 'utf8');
        this.writeInt(bytes.length);
        if (bytes.length > 0) {
            this._chunks.push(bytes);
        }
    }

    toBuffer() {
        return Buffer.concat(this._chunks);
    }
}

function loadModule(modulePath) {
    const resolved = require.resolve(modulePath);
    delete require.cache[resolved];
    return require(resolved);
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function escapeTsString(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');
}

function sanitizeComment(value) {
    return String(value ?? '').replace(/\*\//g, '*\\/');
}

function pushDocComment(lines, text, indent = '') {
    const parts = String(text ?? '').split('\n');
    if (parts.length === 1) {
        lines.push(`${indent}/** ${sanitizeComment(parts[0])} */`);
        return;
    }

    lines.push(`${indent}/**`);
    for (const part of parts) {
        lines.push(`${indent} * ${sanitizeComment(part)}`);
    }
    lines.push(`${indent} */`);
}

function coerceInt(value, fieldName, context) {
    const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (!Number.isInteger(numeric)) {
        throw new Error(`${context} field ${fieldName} must be an integer, got ${value}`);
    }
    return numeric;
}

function coerceBool(value, fieldName, context) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === 0 || value === 1) {
        return Boolean(value);
    }
    throw new Error(`${context} field ${fieldName} must be a boolean, got ${value}`);
}

function coerceNumber(value, fieldName, context) {
    const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (!Number.isFinite(numeric)) {
        throw new Error(`${context} field ${fieldName} must be a number, got ${value}`);
    }
    return numeric;
}

function coerceString(value, fieldName, context) {
    if (value == null) {
        throw new Error(`${context} field ${fieldName} must be a string, got ${value}`);
    }
    return String(value);
}

function normalizeFieldValue(field, value, context) {
    switch (field.type) {
        case 'int':
            return coerceInt(value, field.name, context);
        case 'bool':
            return coerceBool(value, field.name, context);
        case 'float':
        case 'double':
            return coerceNumber(value, field.name, context);
        case 'string':
            return coerceString(value, field.name, context);
        default:
            throw new Error(`${context} has unsupported type ${field.type}`);
    }
}

function normalizeRows(tableDef, rawData) {
    const primaryField = tableDef.fields.find((field) => field.name === tableDef.primaryKey);
    if (!primaryField) {
        throw new Error(`Table ${tableDef.tableClassName} is missing primary key field ${tableDef.primaryKey}`);
    }

    let rows;
    if (Array.isArray(rawData)) {
        rows = rawData.map((row, index) => ({ ...row }));
    } else if (rawData && typeof rawData === 'object') {
        rows = Object.entries(rawData).map(([key, row]) => {
            const value = row && typeof row === 'object' ? { ...row } : {};
            if (value[tableDef.primaryKey] == null) {
                value[tableDef.primaryKey] = key;
            }
            return value;
        });
    } else {
        throw new Error(`Table ${tableDef.tableClassName} data must export an object or array`);
    }

    const runtimeFields = tableDef.fields.filter((field) => field.runtime !== false);
    const seenKeys = new Set();

    const normalized = rows.map((row, index) => {
        const context = `${tableDef.tableClassName}[${index}]`;
        const output = {};

        for (const field of tableDef.fields) {
            if (!(field.name in row)) {
                throw new Error(`${context} is missing field ${field.name}`);
            }
            output[field.name] = normalizeFieldValue(field, row[field.name], context);
        }

        const key = output[tableDef.primaryKey];
        if (seenKeys.has(key)) {
            throw new Error(`Table ${tableDef.tableClassName} has duplicate key ${key}`);
        }
        seenKeys.add(key);

        for (const extraKey of Object.keys(row)) {
            if (!tableDef.fields.some((field) => field.name === extraKey)) {
                throw new Error(`${context} contains unknown field ${extraKey}`);
            }
        }

        const runtimeOutput = {};
        for (const field of runtimeFields) {
            runtimeOutput[field.name] = output[field.name];
        }

        return { all: output, runtime: runtimeOutput };
    });

    normalized.sort((left, right) => {
        const a = left.all[tableDef.primaryKey];
        const b = right.all[tableDef.primaryKey];
        if (typeof a === 'number' && typeof b === 'number') {
            return a - b;
        }
        return String(a).localeCompare(String(b));
    });

    return normalized;
}

function encodeValue(writer, field, value) {
    switch (field.type) {
        case 'bool':
            writer.writeBool(value);
            break;
        case 'int':
            writer.writeInt(value);
            break;
        case 'float':
            writer.writeFloat(value);
            break;
        case 'double':
            writer.writeDouble(value);
            break;
        case 'string':
            writer.writeString(value);
            break;
        default:
            throw new Error(`Unsupported field type: ${field.type}`);
    }
}

function buildBinary(tableDef, normalizedRows) {
    const runtimeFields = tableDef.fields.filter((field) => field.runtime !== false);
    const writer = new ByteWriter();
    writer.writeInt(normalizedRows.length);

    for (const row of normalizedRows) {
        for (const field of runtimeFields) {
            encodeValue(writer, field, row.runtime[field.name]);
        }
    }

    return writer.toBuffer();
}

function generateSchema(tableDefs) {
    const lines = [];
    lines.push('//------------------------------------------------------------------------------');
    lines.push('// <auto-generated>');
    lines.push('//     This code was generated by Tools/config/build-config.js.');
    lines.push('//     Do not edit this file directly.');
    lines.push('// </auto-generated>');
    lines.push('//------------------------------------------------------------------------------');
    lines.push('');
    lines.push('');
    lines.push(`import ByteBuf from '../luban/ByteBuf'`);
    lines.push('');

    for (const tableDef of tableDefs) {
        const runtimeFields = tableDef.fields.filter((field) => field.runtime !== false);
        lines.push('');
        lines.push('');
        lines.push('');
        lines.push(`export namespace ${tableDef.namespace} {`);
        lines.push(`export class ${tableDef.recordName} {`);
        lines.push('');
        lines.push('    constructor(_buf_: ByteBuf) {');
        for (const field of runtimeFields) {
            lines.push(`        this.${field.name} = _buf_.${TYPE_READERS[field.type]}()`);
        }
        lines.push('    }');
        lines.push('');

        for (const field of runtimeFields) {
            pushDocComment(lines, field.comment, '    ');
            lines.push(`    readonly ${field.name}: ${TYPE_TS[field.type]}`);
        }

        lines.push('');
        lines.push('    resolve(_tables: Tables) {');
        lines.push('    }');
        lines.push('}');
        lines.push('');
        lines.push('}');
    }

    for (const tableDef of tableDefs) {
        lines.push('');
        lines.push('');
        lines.push(`export namespace ${tableDef.namespace} {`);
        pushDocComment(lines, tableDef.tableComment);
        lines.push(`export class ${tableDef.tableClassName} {`);
        lines.push(`    private _dataMap: Map<number, ${tableDef.namespace}.${tableDef.recordName}>`);
        lines.push(`    private _dataList: ${tableDef.namespace}.${tableDef.recordName}[]`);
        lines.push('    constructor(_buf_: ByteBuf) {');
        lines.push(`        this._dataMap = new Map<number, ${tableDef.namespace}.${tableDef.recordName}>()`);
        lines.push('        this._dataList = []');
        lines.push('        for (let n = _buf_.readInt(); n > 0; n--) {');
        lines.push(`            const _v = new ${tableDef.namespace}.${tableDef.recordName}(_buf_)`);
        lines.push('            this._dataList.push(_v)');
        lines.push(`            this._dataMap.set(_v.${tableDef.primaryKey}, _v)`);
        lines.push('        }');
        lines.push('    }');
        lines.push('');
        lines.push(`    getDataMap(): Map<number, ${tableDef.namespace}.${tableDef.recordName}> { return this._dataMap; }`);
        lines.push(`    getDataList(): ${tableDef.namespace}.${tableDef.recordName}[] { return this._dataList; }`);
        lines.push('');
        lines.push(`    get(key: number): ${tableDef.namespace}.${tableDef.recordName} | undefined {`);
        lines.push('        return this._dataMap.get(key);');
        lines.push('    }');
        lines.push('');
        lines.push('    resolve(tables: Tables) {');
        lines.push('        for (const data of this._dataList) {');
        lines.push('            data.resolve(tables)');
        lines.push('        }');
        lines.push('    }');
        lines.push('');
        lines.push('}');
        lines.push('}');
    }

    lines.push('');
    lines.push('');
    lines.push('type ByteBufLoader = (file: string) => ByteBuf');
    lines.push('');
    lines.push('export class Tables {');

    for (const tableDef of tableDefs) {
        lines.push(`    private _${tableDef.tableClassName}: ${tableDef.namespace}.${tableDef.tableClassName}`);
        pushDocComment(lines, tableDef.tableComment, '    ');
        lines.push(`    get ${tableDef.tableClassName}(): ${tableDef.namespace}.${tableDef.tableClassName} { return this._${tableDef.tableClassName}; }`);
    }

    lines.push('');
    lines.push('    static getTableNames(): string[] {');
    lines.push('        const names: string[] = [];');
    for (const tableDef of tableDefs) {
        lines.push(`        names.push('${tableDef.fileName}');`);
    }
    lines.push('        return names;');
    lines.push('    }');
    lines.push('');
    lines.push('    constructor(loader: ByteBufLoader) {');
    for (const tableDef of tableDefs) {
        lines.push(`        this._${tableDef.tableClassName} = new ${tableDef.namespace}.${tableDef.tableClassName}(loader('${tableDef.fileName}'))`);
    }
    lines.push('');
    for (const tableDef of tableDefs) {
        lines.push(`        this._${tableDef.tableClassName}.resolve(this)`);
    }
    lines.push('    }');
    lines.push('}');
    lines.push('');

    return lines.join('\n');
}

function generateTextId(tableDef, normalizedRows) {
    const enumField = tableDef.enumField;
    const commentField = tableDef.enumCommentField;
    const sourceLabel = path.posix.join('Config', 'data', tableDef.dataFile);
    const lines = [];

    lines.push('/**');
    lines.push(' * 文本 ID 枚举（自动生成，请勿手动修改）');
    lines.push(' *');
    lines.push(` * 生成时间: ${new Date().toISOString()}`);
    lines.push(` * 数据来源: ${sourceLabel}`);
    lines.push(' */');
    lines.push(`export enum ${tableDef.enumName} {`);

    for (const row of normalizedRows) {
        const enumName = row.all[enumField];
        if (!enumName) {
            continue;
        }

        pushDocComment(lines, row.all[commentField], '    ');
        lines.push(`    ${enumName} = ${row.all[tableDef.primaryKey]},`);
        lines.push('');
    }

    if (lines[lines.length - 1] === '') {
        lines.pop();
    }

    lines.push('}');
    lines.push('');
    return lines.join('\n');
}

function ensureMetaFile(binPath) {
    const metaPath = `${binPath}.meta`;
    if (fs.existsSync(metaPath)) {
        return;
    }

    const meta = {
        ver: '1.0.3',
        importer: 'buffer',
        imported: true,
        uuid: crypto.randomUUID(),
        files: ['.bin', '.json'],
        subMetas: {},
        userData: {},
    };

    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

function main() {
    const tableDefs = loadModule(SCHEMA_DEFINITION_PATH);
    ensureDir(path.dirname(OUTPUT_SCHEMA_PATH));
    ensureDir(path.dirname(OUTPUT_TEXT_ID_PATH));
    ensureDir(OUTPUT_BIN_DIR);

    const normalizedByTable = new Map();

    for (const tableDef of tableDefs) {
        const dataPath = path.join(DATA_DIR, tableDef.dataFile);
        const rawData = loadModule(dataPath);
        const normalizedRows = normalizeRows(tableDef, rawData);
        normalizedByTable.set(tableDef.tableClassName, normalizedRows);

        const buffer = buildBinary(tableDef, normalizedRows);
        const outputPath = path.join(OUTPUT_BIN_DIR, `${tableDef.fileName}.bin`);
        fs.writeFileSync(outputPath, buffer);
        ensureMetaFile(outputPath);
    }

    fs.writeFileSync(OUTPUT_SCHEMA_PATH, `${generateSchema(tableDefs)}\n`, 'utf8');

    const textTable = tableDefs.find((tableDef) => tableDef.enumName);
    if (textTable) {
        const normalizedRows = normalizedByTable.get(textTable.tableClassName) || [];
        fs.writeFileSync(OUTPUT_TEXT_ID_PATH, generateTextId(textTable, normalizedRows), 'utf8');
    }

    console.log(`[build-config] generated ${tableDefs.length} tables`);
}

try {
    main();
} catch (error) {
    console.error('[build-config] failed:', error);
    process.exitCode = 1;
}