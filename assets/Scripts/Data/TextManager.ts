/**
 * 文本管理器
 *
 * 核心职责：
 * 1. 管理本地化文本的读取与语言切换
 * 2. 隐藏 TbText 表的字段映射细节，业务层只需传入 ID
 * 3. 支持 TextId 枚举，避免魔法数字
 * 4. 支持带占位符 {0} {1} ... 的格式化文本
 * 5. 自动将 \n 转义序列转换为实际换行
 * 6. 单例模式，全局唯一
 *
 * 快速上手：
 * ```ts
 * // 1. 切换语言（默认 zhCn）
 * TextManager.getInstance().language = 'en';
 *
 * // 2. 通过枚举获取文本（推荐）
 * TextManager.getInstance().getText(TextId.Score);       // → "Score"
 *
 * // 3. 通过数字 ID 获取文本
 * TextManager.getInstance().getText(1001);               // → "Score"
 * TextManager.getInstance().getText(1001, 'zhCn');       // → "得分"
 *
 * // 4. 格式化带占位符的文本
 * TextManager.getInstance().getText(TextId.Invincible);          // → "🛡 无敌 {0}s"
 * TextManager.formatText(TextId.Invincible, 5);                  // → "🛡 无敌 5s"
 * TextManager.formatText(TextId.Invincible, 5, 'zhCn');         // → "🛡 无敌 5s"
 * ```
 */

import { text } from './schema/schema';
import { TextId } from './TextId';

/** 支持的语言类型，新增语言时在此扩展并更新 LANG_FIELD_MAP */
export type Language = 'zhCn' | 'en';

/** 语言代码 → Text 记录字段名的映射 */
const LANG_FIELD_MAP: Record<Language, keyof text.Text> = {
    zhCn: 'ZhCn',
    en: 'En',
};

export class TextManager {
    private static _instance: TextManager | null = null;

    /** TbText 表实例 */
    private _tbText: text.TbText | null = null;

    /** 当前语言 */
    private _language: Language = 'zhCn';

    private constructor() {}

    /** 获取单例 */
    static getInstance(): TextManager {
        if (!TextManager._instance) {
            TextManager._instance = new TextManager();
        }
        return TextManager._instance;
    }

    /** 销毁单例（通常只在测试中使用） */
    static destroyInstance(): void {
        if (TextManager._instance) {
            TextManager._instance.reset();
            TextManager._instance = null;
        }
    }

    /** 获取/设置当前语言 */
    get language(): Language {
        return this._language;
    }

    set language(lang: Language) {
        this._language = lang;
    }

    /**
     * 初始化文本管理器（由 DataManager.load 内部调用）
     *
     * @param tbText TbText 表实例
     */
    init(tbText: text.TbText): void {
        this._tbText = tbText;
    }

    /**
     * 获取本地化文本
     *
     * 自动将 \n 转义序列转换为实际换行符。
     *
     * @param id 文本 ID（支持 TextId 枚举或数字）
     * @param lang 可选，指定语言（默认使用当前语言）
     * @returns 文本内容，未找到时返回空字符串
     *
     * ```ts
     * TextManager.getInstance().getText(TextId.Score);     // 使用枚举（推荐）
     * TextManager.getInstance().getText(1001);             // 使用数字
     * TextManager.getInstance().getText(TextId.Score, 'en'); // 指定语言
     * ```
     */
    getText(id: TextId | number, lang?: Language): string {
        if (!this._tbText) {
            console.warn('[TextManager] getText called before init');
            return '';
        }
        const numericId = typeof id === 'number' ? id : (id as unknown as number);
        const record = this._tbText.get(numericId);
        if (!record) {
            console.warn(`[TextManager] text not found for id: ${id}`);
            return '';
        }
        const targetLang = lang ?? this._language;
        const field = LANG_FIELD_MAP[targetLang];
        const raw = (record[field] as string) ?? '';
        // 将 \n 转义序列转换为实际换行符
        return raw.replace(/\\n/g, '\n');
    }

    /**
     * 格式化带占位符的文本
     *
     * 先通过 getText 获取文本模板，再将 {0} {1} ... 替换为传入的参数。
     *
     * @param id 文本 ID（支持 TextId 枚举或数字）
     * @param args 格式化参数，{0} 对应 args[0]，{1} 对应 args[1]，以此类推
     * @returns 格式化后的文本
     *
     * ```ts
     * // 模板: "🛡 无敌 {0}s"
     * TextManager.formatText(TextId.Invincible, 5);  // → "🛡 无敌 5s"
     * ```
     */
    static formatText(id: TextId | number, ...args: (string | number)[]): string {
        const inst = TextManager.getInstance();
        let template = inst.getText(id);
        for (let i = 0; i < args.length; i++) {
            template = template.replace(new RegExp(`\\{${i}\\}`, 'g'), String(args[i]));
        }
        return template;
    }

    /**
     * 格式化带占位符的文本（指定语言）
     *
     * @param id 文本 ID
     * @param lang 语言
     * @param args 格式化参数
     * @returns 格式化后的文本
     */
    static formatTextWithLang(id: TextId | number, lang: Language, ...args: (string | number)[]): string {
        const inst = TextManager.getInstance();
        let template = inst.getText(id, lang);
        for (let i = 0; i < args.length; i++) {
            template = template.replace(new RegExp(`\\{${i}\\}`, 'g'), String(args[i]));
        }
        return template;
    }

    /** 重置所有数据 */
    reset(): void {
        this._tbText = null;
    }
}
