import { _decorator, Component, Node, UITransform, Size, tween, Vec3 } from 'cc';
import { UILayer, UIFrame } from './UIFrame';

const { ccclass, property } = _decorator;

/**
 * UIPanel - 面板基类
 *
 * 所有面板都应继承此类，通过 UIFrame.open() 管理。
 *
 * 生命周期：
 * 1. onPanelInit()   - 面板首次创建时调用（仅一次）
 * 2. onPanelOpen()   - 面板打开时调用（每次打开）
 * 3. onPanelClose()  - 面板关闭时调用（每次关闭）
 * 4. onPanelDestroy() - 面板销毁时调用（仅一次）
 *
 * 使用示例：
 * ```ts
 * @ccclass('MainMenuPanel')
 * export class MainMenuPanel extends UIPanel {
 *     protected onPanelOpen(data: any): void {
 *         this.setText('TitleLabel', '游戏标题');
 *     }
 * }
 * ```
 */
@ccclass('UIPanel')
export class UIPanel extends Component {

    /** 面板是否已初始化 */
    private _initialized: boolean = false;

    /** 面板内容容器（用于动画） */
    protected _content: Node | null = null;

    /** 面板配置：所在层级 */
    protected get layer(): UILayer {
        return UILayer.Panel;
    }

    /** 面板配置：是否缓存 */
    protected get cacheable(): boolean {
        return true;
    }

    // ==================== 生命周期 ====================

    onLoad() {
        if (!this._initialized) {
            this._initialized = true;
            this.onPanelInit();
        }
    }

    /** 面板首次创建时调用 - 子类重写以初始化 UI */
    protected onPanelInit(): void {
        // 子类实现
    }

    /** 面板打开时调用 - 子类重写以刷新数据 */
    protected onPanelOpen(data?: any): void {
        this.node.active = true;
        this.playOpenAnimation();
    }

    /** 面板关闭时调用 - 子类重写以清理状态 */
    protected onPanelClose(): void {
        this.playCloseAnimation();
    }

    onDestroy() {
        this.onPanelDestroy();
    }

    /** 面板销毁时调用 - 子类重写以释放资源 */
    protected onPanelDestroy(): void {
        // 子类实现
    }

    // ==================== 打开/关闭动画 ====================

    /** 播放打开动画 */
    protected playOpenAnimation(): void {
        // 默认：从缩小状态恢复
        this.node.setScale(0.9, 0.9, 1);
        tween(this.node)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    /** 播放关闭动画 */
    protected playCloseAnimation(): void {
        tween(this.node)
            .to(0.15, { scale: new Vec3(0.9, 0.9, 1) }, { easing: 'backIn' })
            .call(() => {
                this.node.active = false;
            })
            .start();
    }

    // ==================== 便捷方法 ====================

    /**
     * 通过路径查找子节点
     * @param path 子节点路径（如 'Content/TitleLabel'）
     */
    protected find(path: string): Node | null {
        return this.node.getChildByPath(path);
    }

    /**
     * 通过路径获取组件
     */
    protected getComponentAt<T>(path: string, type: new (...args: any[]) => T): T | null {
        const node = this.find(path);
        if (!node) return null;
        return node.getComponent(type as any) as T;
    }

    /**
     * 关闭当前面板
     */
    protected closeSelf(): void {
        UIFrame.getInstance().close();
    }

    /**
     * 打开另一个面板
     */
    protected openPanel(panelPath: string, data?: any): void {
        UIFrame.getInstance().open(panelPath, { data, cache: this.cacheable });
    }
}
