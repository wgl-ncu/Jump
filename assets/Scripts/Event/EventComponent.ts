import { _decorator, Component } from 'cc';
import { EventBus, EventHandle } from './EventBus';

const { ccclass } = _decorator;

/**
 * EventComponent - 事件监听混入基类
 *
 * 继承此类的组件可使用 `listen` / `listenOnce` 注册事件，
 * 组件销毁时自动清理所有已注册的事件监听。
 *
 * 使用示例：
 * ```ts
 * @ccclass('MyComponent')
 * export class MyComponent extends EventComponent {
 *     onEnable() {
 *         this.listen('score:change', (e) => {
 *             console.log(e.score);
 *         });
 *     }
 * }
 * ```
 *
 * 如果无法继承（已有基类），可以使用 `EventBus.on(name, cb, componentInstance)` 方式，
 * 并在 onDestroy 中调用 `EventBus.offByTag(this)`。
 */
@ccclass('EventComponent')
export class EventComponent extends Component {

    /** 已注册的事件句柄列表 */
    private _handles: EventHandle[] = [];

    /**
     * 注册事件监听（组件销毁时自动清理）
     *
     * @param name 事件名
     * @param callback 回调函数
     * @returns 事件句柄
     */
    protected listen<K extends keyof import('./EventBus').EventMap>(
        name: K,
        callback: any
    ): EventHandle {
        const handle = EventBus.on(name as string, callback, this);
        this._handles.push(handle);
        return handle;
    }

    /**
     * 注册一次性事件监听（触发一次后自动移除，组件销毁时也会清理）
     */
    protected listenOnce<K extends keyof import('./EventBus').EventMap>(
        name: K,
        callback: any
    ): EventHandle {
        const handle = EventBus.once(name as string, callback, this);
        this._handles.push(handle);
        return handle;
    }

    /**
     * 取消指定事件监听
     */
    protected unlisten(handle: EventHandle): void {
        EventBus.off(handle);
        const idx = this._handles.indexOf(handle);
        if (idx !== -1) this._handles.splice(idx, 1);
    }

    /**
     * 发射事件（便捷方法）
     */
    protected emit<K extends keyof import('./EventBus').EventMap>(
        name: K,
        ...args: any[]
    ): void {
        (EventBus.emit as any)(name, ...args);
    }

    onDestroy() {
        // 组件销毁时自动清理所有监听
        for (const handle of this._handles) {
            EventBus.off(handle);
        }
        this._handles.length = 0;
        EventBus.offByTag(this);
    }
}
