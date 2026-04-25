/**
 * EventBus - 全局类型安全事件系统
 *
 * 特性：
 * - 类型安全：事件名与载荷类型关联，编译期检查
 * - 多播：同一事件支持多个监听者
 * - once：一次性监听，触发后自动移除
 * - 自动清理：通过 tag 绑定组件生命周期，组件销毁时自动 off
 * - 零依赖：纯 TypeScript，不依赖 Cocos
 *
 * 使用示例：
 * ```ts
 * // 定义事件类型（在 GameEvents.ts 中）
 * interface MyEvents {
 *     'score:change': { score: number };
 *     'player:die': undefined;
 * }
 *
 * // 监听
 * const handle = EventBus.on('score:change', (e) => {
 *     console.log(e.score); // 类型推断为 number
 * });
 *
 * // 发射
 * EventBus.emit('score:change', { score: 100 });
 *
 * // 取消监听
 * EventBus.off(handle);
 *
 * // 绑定组件生命周期，组件销毁时自动取消
 * EventBus.on('score:change', callback, this);
 * ```
 */

/** 监听句柄 - 用于取消注册 */
export interface EventHandle {
    /** 事件名 */
    readonly name: string;
    /** 内部 ID */
    readonly id: number;
}

/** 监听记录（内部） */
interface ListenerEntry {
    id: number;
    callback: Function;
    once: boolean;
    tag?: object;  // 绑定生命周期的对象引用
}

/** 全局自增 ID */
let _nextId = 1;

/** 全局事件映射表 - 子项目通过 declare module 扩展 */
export interface EventMap {
    // 由 GameEvents.ts 扩展
}

/**
 * 事件载荷类型提取
 * - undefined 表示无载荷事件
 * - 其他类型为载荷类型
 */
export type EventPayload<T extends keyof EventMap> = EventMap[T];

/** 回调函数类型 */
export type EventCallback<T> = T extends undefined
    ? () => void
    : (payload: T) => void;

export class EventBus {

    /** 所有监听记录 { eventName => entries[] } */
    private static _listeners: Map<string, ListenerEntry[]> = new Map();

    /** handle.id => eventName 快速查找（用于 off） */
    private static _handleMap: Map<number, string> = new Map();

    /** WeakMap<tag, handleId[]> 用于 tag 自动清理 */
    private static _tagMap: WeakMap<object, Set<number>> = new WeakMap();

    // ==================== 注册 ====================

    /**
     * 注册事件监听
     *
     * @param name 事件名
     * @param callback 回调函数
     * @param tag 绑定生命周期的对象（通常是 Component 实例），销毁时自动 off
     * @returns 监听句柄，用于取消注册
     */
    static on<K extends keyof EventMap>(
        name: K,
        callback: EventCallback<EventPayload<K>>,
        tag?: object
    ): EventHandle {
        return this._addListener(name as string, callback, false, tag);
    }

    /**
     * 注册一次性事件监听（触发一次后自动移除）
     */
    static once<K extends keyof EventMap>(
        name: K,
        callback: EventCallback<EventPayload<K>>,
        tag?: object
    ): EventHandle {
        return this._addListener(name as string, callback, true, tag);
    }

    // ==================== 取消注册 ====================

    /**
     * 通过句柄取消监听
     */
    static off(handle: EventHandle): void {
        const eventName = this._handleMap.get(handle.id);
        if (eventName === undefined) return;

        this._handleMap.delete(handle.id);
        const entries = this._listeners.get(eventName);
        if (entries) {
            const idx = entries.findIndex(e => e.id === handle.id);
            if (idx !== -1) entries.splice(idx, 1);
            if (entries.length === 0) this._listeners.delete(eventName);
        }
    }

    /**
     * 取消指定事件的所有监听
     */
    static offByName<K extends keyof EventMap>(name: K): void {
        const eventName = name as string;
        const entries = this._listeners.get(eventName);
        if (entries) {
            for (const entry of entries) {
                this._handleMap.delete(entry.id);
            }
            this._listeners.delete(eventName);
        }
    }

    /**
     * 取消绑定到指定 tag 的所有监听
     * 组件销毁时自动调用
     */
    static offByTag(tag: object): void {
        const handleIds = this._tagMap.get(tag);
        if (!handleIds) return;

        for (const id of handleIds) {
            const eventName = this._handleMap.get(id);
            if (eventName !== undefined) {
                this._handleMap.delete(id);
                const entries = this._listeners.get(eventName);
                if (entries) {
                    const idx = entries.findIndex(e => e.id === id);
                    if (idx !== -1) entries.splice(idx, 1);
                    if (entries.length === 0) this._listeners.delete(eventName);
                }
            }
        }

        this._tagMap.delete(tag);
    }

    // ==================== 发射 ====================

    /**
     * 发射事件
     *
     * 按注册顺序同步调用所有监听者。
     * once 监听者在触发后自动移除。
     *
     * @param name 事件名
     * @param payload 事件载荷
     */
    static emit<K extends keyof EventMap>(
        name: K,
        ...args: EventPayload<K> extends undefined ? [] : [EventPayload<K>]
    ): void {
        const eventName = name as string;
        const entries = this._listeners.get(eventName);
        if (!entries || entries.length === 0) return;

        // 复制一份，防止回调中修改列表
        const snapshot = entries.slice();
        const toRemove: number[] = [];

        for (const entry of snapshot) {
            // 跳过已被移除的
            if (!this._handleMap.has(entry.id)) continue;

            try {
                if (entry.once) {
                    toRemove.push(entry.id);
                }
                // 调用回调
                if (args.length > 0) {
                    entry.callback(args[0]);
                } else {
                    entry.callback();
                }
            } catch (err) {
                console.error(`[EventBus] 事件 "${eventName}" 回调错误:`, err);
            }
        }

        // 清除 once 监听
        for (const id of toRemove) {
            this._doRemove(id, eventName);
        }
    }

    // ==================== 查询 ====================

    /** 是否有指定事件的监听者 */
    static has<K extends keyof EventMap>(name: K): boolean {
        const entries = this._listeners.get(name as string);
        return !!entries && entries.length > 0;
    }

    /** 获取指定事件的监听者数量 */
    static listenerCount<K extends keyof EventMap>(name: K): number {
        const entries = this._listeners.get(name as string);
        return entries ? entries.length : 0;
    }

    /** 清除所有监听 */
    static clear(): void {
        this._listeners.clear();
        this._handleMap.clear();
        // _tagMap 是 WeakMap，不需要手动清
    }

    // ==================== 内部方法 ====================

    private static _addListener(
        name: string,
        callback: Function,
        once: boolean,
        tag?: object
    ): EventHandle {
        const id = _nextId++;
        const entry: ListenerEntry = { id, callback, once, tag };

        let entries = this._listeners.get(name);
        if (!entries) {
            entries = [];
            this._listeners.set(name, entries);
        }
        entries.push(entry);

        this._handleMap.set(id, name);

        // tag 绑定
        if (tag) {
            let handleIds = this._tagMap.get(tag);
            if (!handleIds) {
                handleIds = new Set();
                this._tagMap.set(tag, handleIds);
            }
            handleIds.add(id);
        }

        return { name, id };
    }

    private static _doRemove(id: number, eventName: string): void {
        this._handleMap.delete(id);
        const entries = this._listeners.get(eventName);
        if (entries) {
            const idx = entries.findIndex(e => e.id === id);
            if (idx !== -1) entries.splice(idx, 1);
            if (entries.length === 0) this._listeners.delete(eventName);
        }
    }
}
