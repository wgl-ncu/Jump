/**
 * 二进制配置读取器 - ByteBuf
 *
 * 纯浏览器兼容实现，不依赖 Node.js Buffer。
 * 使用 DataView + Uint8Array 读取项目构建出的二进制配置数据。
 */

/* MIN_CAPACITY unused - kept for reference: 16 */
const f_2power32 = Math.pow(2, 32);

export default class ByteBuf {
    private _bytes: Uint8Array;
    private _view: DataView;
    private _readerIndex: number = 0;
    private _writerIndex: number = 0;

    constructor(bytes?: Uint8Array) {
        if (bytes != null) {
            this._bytes = bytes;
            this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            this._writerIndex = bytes.length;
        } else {
            this._bytes = new Uint8Array(0);
            this._view = new DataView(this._bytes.buffer);
        }
    }

    Replace(bytes: Uint8Array): void {
        this._bytes = bytes;
        this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        this._readerIndex = 0;
        this._writerIndex = bytes.length;
    }

    get capacity(): number { return this._bytes.length; }
    get size(): number { return this._writerIndex - this._readerIndex; }
    get empty(): boolean { return this._writerIndex <= this._readerIndex; }
    get notEmpty(): boolean { return this._writerIndex > this._readerIndex; }
    get remaining(): number { return this._writerIndex - this._readerIndex; }

    addReadIndex(add: number): void {
        this._readerIndex += add;
    }

    private ensureRead(size: number): void {
        if (this._readerIndex + size > this._writerIndex) {
            throw new Error(`ByteBuf: read overflow, need ${size}, remaining ${this.remaining}`);
        }
    }

    // ─── 基础类型读取 ──────────────────────────────────────

    readBool(): boolean {
        this.ensureRead(1);
        return this._bytes[this._readerIndex++] !== 0;
    }

    readByte(): number {
        this.ensureRead(1);
        return this._bytes[this._readerIndex++];
    }

    // ─── 变长整数编码 ─────────────────────────────────────

    readShort(): number {
        this.ensureRead(1);
        const h = this._bytes[this._readerIndex];
        if (h < 0x80) {
            this._readerIndex++;
            return h;
        } else if (h < 0xc0) {
            this.ensureRead(2);
            const x = this._readUint16BE() & 0x3fff;
            return x;
        } else if (h === 0xff) {
            this.ensureRead(3);
            this._readerIndex++; // skip header
            const x = this._readInt16BE();
            return x;
        } else {
            throw new Error(`ByteBuf: invalid short header 0x${h.toString(16)}`);
        }
    }

    readInt(): number {
        this.ensureRead(1);
        const h = this._bytes[this._readerIndex];
        if (h < 0x80) {
            this._readerIndex++;
            return h;
        } else if (h < 0xc0) {
            this.ensureRead(2);
            const x = this._readUint16BE() & 0x3fff;
            return x;
        } else if (h < 0xe0) {
            this.ensureRead(3);
            const x = ((h & 0x1f) << 16) | this._readUint16BE();
            return x;
        } else if (h < 0xf0) {
            this.ensureRead(4);
            const x = this._readInt32BE() & 0x0fffffff;
            return x;
        } else {
            this.ensureRead(5);
            this._readerIndex++; // skip header
            const x = this._readInt32BE();
            return x;
        }
    }

    readFint(): number {
        this.ensureRead(4);
        return this._readInt32LE();
    }

    readLongAsNumber(): number {
        this.ensureRead(1);
        const h = this._bytes[this._readerIndex];
        if (h < 0x80) {
            this._readerIndex++;
            return h;
        } else if (h < 0xc0) {
            this.ensureRead(2);
            return this._readUint16BE() & 0x3fff;
        } else if (h < 0xe0) {
            this.ensureRead(3);
            return ((h & 0x1f) << 16) | this._readUint16BE();
        } else if (h < 0xf0) {
            this.ensureRead(4);
            return this._readInt32BE() & 0x0fffffff;
        } else if (h < 0xf8) {
            this.ensureRead(5);
            this._readerIndex++; // skip header
            const xl = this._readUint32BE();
            const xh = h & 0x07;
            return xh * 0x100000000 + xl;
        } else if (h < 0xfc) {
            this.ensureRead(6);
            const xh = this._readUint16BE() & 0x3ff;
            const xl = this._readUint32BE();
            return xh * 0x100000000 + xl;
        } else if (h < 0xfe) {
            this.ensureRead(7);
            const xh = (this._readUint32BE() >> 8) & 0x1ffff;
            const xl = this._readUint32BE();
            return xh * 0x100000000 + xl;
        } else if (h < 0xff) {
            this.ensureRead(8);
            const xh = this._readUint32BE() & 0xffffff;
            const xl = this._readUint32BE();
            return xh * f_2power32 + xl;
        } else {
            this.ensureRead(9);
            this._readerIndex++; // skip 0xff header
            const high = this._readInt32BE();
            const low = this._readUint32BE();
            return high * f_2power32 + low;
        }
    }

    readLong(): number {
        return this.readLongAsNumber();
    }

    readFloat(): number {
        this.ensureRead(4);
        return this._readFloatLE();
    }

    readDouble(): number {
        this.ensureRead(8);
        return this._readDoubleLE();
    }

    readSize(): number {
        return this.readInt();
    }

    readString(): string {
        const n = this.readSize();
        if (n > 0) {
            this.ensureRead(n);
            const slice = this._bytes.subarray(this._readerIndex, this._readerIndex + n);
            this._readerIndex += n;
            return this._decodeUtf8(slice);
        }
        return '';
    }

    readBytes(): Uint8Array {
        const n = this.readSize();
        if (n > 0) {
            this.ensureRead(n);
            const result = new Uint8Array(n);
            result.set(this._bytes.subarray(this._readerIndex, this._readerIndex + n));
            this._readerIndex += n;
            return result;
        }
        return new Uint8Array(0);
    }

    readArrayBuffer(): ArrayBuffer {
        const bytes = this.readBytes();
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }

    SkipBytes(): void {
        const n = this.readSize();
        this.ensureRead(n);
        this._readerIndex += n;
    }

    // ─── DataView 辅助方法 ─────────────────────────────────

    private _readUint16BE(): number {
        const v = this._view.getUint16(this._readerIndex, false);
        this._readerIndex += 2;
        return v;
    }

    private _readInt16BE(): number {
        const v = this._view.getInt16(this._readerIndex, false);
        this._readerIndex += 2;
        return v;
    }

    private _readUint32BE(): number {
        const v = this._view.getUint32(this._readerIndex, false);
        this._readerIndex += 4;
        return v;
    }

    private _readInt32BE(): number {
        const v = this._view.getInt32(this._readerIndex, false);
        this._readerIndex += 4;
        return v;
    }

    private _readInt32LE(): number {
        const v = this._view.getInt32(this._readerIndex, true);
        this._readerIndex += 4;
        return v;
    }


    private _readFloatLE(): number {
        const v = this._view.getFloat32(this._readerIndex, true);
        this._readerIndex += 4;
        return v;
    }

    private _readDoubleLE(): number {
        const v = this._view.getFloat64(this._readerIndex, true);
        this._readerIndex += 8;
        return v;
    }

    // ─── UTF-8 解码 ───────────────────────────────────────

    private _decodeUtf8(bytes: Uint8Array): string {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder('utf-8').decode(bytes);
        }
        // Fallback for environments without TextDecoder
        let result = '';
        let i = 0;
        while (i < bytes.length) {
            let c = bytes[i++];
            if (c < 0x80) {
                result += String.fromCharCode(c);
            } else if (c < 0xe0) {
                result += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
            } else if (c < 0xf0) {
                result += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
            } else {
                const cp = ((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
                result += String.fromCharCode(0xd800 | ((cp - 0x10000) >> 10), 0xdc00 | ((cp - 0x10000) & 0x3ff));
            }
        }
        return result;
    }
}
