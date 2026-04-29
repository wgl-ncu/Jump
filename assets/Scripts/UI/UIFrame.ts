import { _decorator, Component, Node, UITransform, Size, director, Director, log, warn, Sprite, Color, Label, Overflow, HorizontalTextAlignment, resources, Prefab, instantiate } from 'cc';

const { ccclass } = _decorator;

/**
 * UI 层级定义（从底到顶）
 */
export enum UILayer {
    /** 背景层 - 场景背景、远景等 */
    Background = 0,
    /** 场景层 - 游戏实体 */
    Scene = 1,
    /** HUD 层 - 游戏内常驻信息（分数、生命值等） */
    HUD = 2,
    /** 面板层 - 全屏面板（主菜单、设置、背包等） */
    Panel = 3,
    /** 弹窗层 - 模态弹窗（确认框、奖励弹窗等） */
    Popup = 4,
    /** 提示层 - Toast、飘字等 */
    Toast = 5,
}

/** 面板打开参数 */
export interface UIPanelOptions {
    /** 是否缓存面板（关闭后不销毁） */
    cache?: boolean;
    /** 是否模态（显示遮罩） */
    modal?: boolean;
    /** 遮罩透明度 0-255 */
    maskAlpha?: number;
    /** 传入面板的数据 */
    data?: any;
    /** 打开完成回调 */
    onOpened?: () => void;
    /** 关闭完成回调 */
    onClosed?: () => void;
}

/** 面板实例信息 */
interface PanelEntry {
    panelPath: string;
    node: Node;
    options: UIPanelOptions;
}

/**
 * UIFrame - 全局 UI 管理框架
 *
 * 职责：
 * - 管理 UI 层级（Background / Scene / HUD / Panel / Popup / Toast）
 * - 面板栈 push/pop 导航
 * - 面板缓存与生命周期管理
 * - 支持从预制体加载面板
 * - 全局 Toast 消息
 *
 * 使用方式：
 * ```ts
 * // 注册预制体面板
 * UIFrame.getInstance().registerPrefab('MainUI', 'Prefabs/UI/MainUI');
 * // 打开面板
 * UIFrame.getInstance().open('MainUI', { cache: true });
 * // 打开代码创建的面板
 * UIFrame.getInstance().open('SettingsPopup', { modal: true });
 * // Toast
 * UIFrame.getInstance().toast('保存成功！');
 * ```
 */
@ccclass('UIFrame')
export class UIFrame extends Component {

    private static _instance: UIFrame | null = null;

    /** 各层级根节点 */
    private _layers: Map<UILayer, Node> = new Map();

    /** 当前打开的面板栈（按打开顺序，栈顶为最新） */
    private _panelStack: PanelEntry[] = [];

    /** 缓存的面板 { path => node } */
    private _panelCache: Map<string, Node> = new Map();

    /** 面板预制体路径映射 { panelPath => resources相对路径 } */
    private _prefabPathMap: Map<string, string> = new Map();

    /** 设计分辨率 */
    private readonly DESIGN_WIDTH = 720;
    private readonly DESIGN_HEIGHT = 1280;

    /** 根 Canvas 节点 */
    private _rootNode: Node | null = null;

    /** Toast 节点 */
    private _toastContainer: Node | null = null;

    public static getInstance(): UIFrame {
        if (!UIFrame._instance) {
            UIFrame._instance = UIFrame.createInstance();
        }
        return UIFrame._instance;
    }

    /** 创建全局实例（挂在持久化节点上） */
    private static createInstance(): UIFrame {
        const rootNode = new Node('[UIFrame]');
        rootNode.addComponent(UITransform).setContentSize(new Size(720, 1280));
        rootNode.setPosition(360, 640, 0);
        const frame = rootNode.addComponent(UIFrame);
        director.addPersistRootNode(rootNode);
        frame.init();
        return frame;
    }

    /** 初始化各层级 */
    public init() {
        if (this._rootNode) return;

        this._rootNode = this.node;
        this._layers.clear();
        this._panelStack = [];
        this._panelCache.clear();

        const layerNames: Record<UILayer, string> = {
            [UILayer.Background]: 'Layer_Background',
            [UILayer.Scene]: 'Layer_Scene',
            [UILayer.HUD]: 'Layer_HUD',
            [UILayer.Panel]: 'Layer_Panel',
            [UILayer.Popup]: 'Layer_Popup',
            [UILayer.Toast]: 'Layer_Toast',
        };

        for (const key of Object.keys(layerNames)) {
            const layer = parseInt(key) as UILayer;
            const node = new Node(layerNames[layer]);
            node.setParent(this._rootNode);
            node.addComponent(UITransform).setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));
            node.setSiblingIndex(layer);
            this._layers.set(layer, node);
        }

        log('[UIFrame] 初始化完成');
    }

    /** 确保已初始化（兼容首次调用时 init 尚未执行的情况） */
    public ensureInit(): void {
        if (!this._rootNode) {
            this.init();
        }
    }

    // ==================== 层级管理 ====================

    /** 获取指定层级根节点 */
    public getLayer(layer: UILayer): Node | null {
        return this._layers.get(layer) || null;
    }

    /** 将节点添加到指定层级 */
    public addToLayer(node: Node, layer: UILayer) {
        const layerNode = this._layers.get(layer);
        if (layerNode) {
            node.setParent(layerNode);
        } else {
            warn(`[UIFrame] 层级 ${layer} 不存在`);
        }
    }

    // ==================== 面板管理 ====================

    /**
     * 注册面板预制体路径
     * @param panelPath 面板标识（对应 @ccclass 名）
     * @param prefabPath resources 目录下的相对路径（不含后缀）
     */
    public registerPrefab(panelPath: string, prefabPath: string): void {
        this._prefabPathMap.set(panelPath, prefabPath);
    }

    /**
     * 打开面板
     * @param panelPath 面板标识（如 'MainUI'），对应 UIPanel 子类名
     * @param options 打开参数
     */
    public open(panelPath: string, options: UIPanelOptions = {}): void {
        this.ensureInit();

        const { cache = true, modal = false, maskAlpha = 160, data = null, onOpened, onClosed } = options;

        // 如果已在栈顶，不重复打开
        const topEntry = this._panelStack[this._panelStack.length - 1];
        if (topEntry && topEntry.panelPath === panelPath) {
            return;
        }

        // 检查缓存
        const cachedNode = this._panelCache.get(panelPath);
        if (cachedNode) {
            cachedNode.active = true;
            this._panelCache.delete(panelPath);
            this.finishOpen(panelPath, cachedNode, options);
            return;
        }

        // 检查预制体
        const prefabPath = this._prefabPathMap.get(panelPath);
        if (prefabPath) {
            this.openFromPrefab(panelPath, prefabPath, options);
            return;
        }

        // 默认：代码创建
        const panelNode = this.createPanelNode(panelPath, data);
        this.finishOpen(panelPath, panelNode, options);
    }

    /**
     * 完成面板打开（添加到层级、入栈、通知）
     */
    private finishOpen(panelPath: string, panelNode: Node, options: UIPanelOptions): void {
        const { cache = true, modal = false, maskAlpha = 160, data = null, onOpened, onClosed } = options;

        const panelComp = this.getPanelComponent(panelNode, panelPath);
        const targetLayer = (panelComp?.layer as UILayer | undefined) ?? UILayer.Panel;

        // 模态遮罩
        if (modal) {
            this.addMask(panelNode, maskAlpha);
        }

        // 添加到目标层
        const panelLayer = this._layers.get(targetLayer) || this._layers.get(UILayer.Panel) || this._layers.get(UILayer.Popup);
        if (panelLayer) {
            panelNode.setParent(panelLayer);
        }

        // 入栈
        const entry: PanelEntry = { panelPath, node: panelNode, options };
        this._panelStack.push(entry);

        // 通知面板打开
        if (panelComp && panelComp.onPanelOpen) {
            panelComp.onPanelOpen(data);
        }

        log(`[UIFrame] 打开面板: ${panelPath}，当前栈深度: ${this._panelStack.length}`);
        onOpened?.();
    }

    /**
     * 从预制体异步加载并打开面板
     */
    private openFromPrefab(panelPath: string, prefabPath: string, options: UIPanelOptions): void {
        resources.load(prefabPath, Prefab, (err, prefab) => {
            if (err) {
                console.error(`[UIFrame] 加载预制体失败: ${prefabPath}`, err);
                return;
            }
            const node = instantiate(prefab);
            // 添加面板组件（通过 panelPath 名字匹配 @ccclass 装饰器名称）
            if (!node.getComponent(panelPath)) {
                node.addComponent(panelPath);
            }
            this.finishOpen(panelPath, node, options);
        });
    }

    /**
     * 关闭栈顶面板
     */
    public close(): void {
        if (this._panelStack.length === 0) return;

        const entry = this._panelStack.pop()!;
        const { panelPath, node, options } = entry;

        // 通知面板关闭
        const panelComp = this.getPanelComponent(node, panelPath);
        if (panelComp && panelComp.onPanelClose) {
            panelComp.onPanelClose();
        }

        // 缓存或销毁
        if (options.cache) {
            node.active = false;
            this._panelCache.set(panelPath, node);
        } else {
            node.destroy();
        }

        log(`[UIFrame] 关闭面板: ${panelPath}，当前栈深度: ${this._panelStack.length}`);
        options.onClosed?.();
    }

    /**
     * 关闭指定面板
     */
    public closePanel(panelPath: string): void {
        const idx = this._panelStack.findIndex(e => e.panelPath === panelPath);
        if (idx === -1) return;

        // 只能关闭栈顶面板（避免破坏栈结构）
        if (idx === this._panelStack.length - 1) {
            this.close();
        } else {
            warn(`[UIFrame] 只能关闭栈顶面板，${panelPath} 不在栈顶`);
        }
    }

    /**
     * 关闭所有面板
     */
    public closeAll(): void {
        while (this._panelStack.length > 0) {
            const entry = this._panelStack.pop()!;
            const panelComp = this.getPanelComponent(entry.node, entry.panelPath);
            if (panelComp && panelComp.onPanelClose) {
                panelComp.onPanelClose();
            }
            if (entry.options.cache) {
                entry.node.active = false;
                this._panelCache.set(entry.panelPath, entry.node);
            } else {
                entry.node.destroy();
            }
            entry.options.onClosed?.();
        }
    }

    /** 获取当前栈顶面板路径 */
    public getTopPanel(): string | null {
        if (this._panelStack.length === 0) return null;
        return this._panelStack[this._panelStack.length - 1].panelPath;
    }

    /** 获取已打开或缓存的面板节点 */
    public getPanelNode(panelPath: string): Node | null {
        for (let index = this._panelStack.length - 1; index >= 0; index--) {
            const entry = this._panelStack[index];
            if (entry.panelPath === panelPath) {
                return entry.node;
            }
        }

        return this._panelCache.get(panelPath) || null;
    }

    /** 面板栈是否为空 */
    public isPanelStackEmpty(): boolean {
        return this._panelStack.length === 0;
    }

    private getPanelComponent(node: Node, panelPath: string): any {
        return (node.getComponent(panelPath) as any) || (node.getComponent('UIPanel') as any);
    }

    // ==================== 面板创建 ====================

    /**
     * 创建面板节点 - 由子类或面板工厂实现
     *
     * 默认实现：创建一个带 UIPanel 组件的节点。
     *
     * @param panelPath 面板标识
     * @param data 面板数据
     */
    protected createPanelNode(panelPath: string, data: any): Node {
        const node = new Node(panelPath);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));
        // 添加 UIPanel 基类组件
        node.addComponent('UIPanel');
        return node;
    }

    /** 添加模态遮罩 */
    protected addMask(parent: Node, alpha: number): Node {
        const mask = new Node('_Mask');
        mask.setParent(parent);
        mask.setSiblingIndex(0);
        const ut = mask.addComponent(UITransform);
        ut.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));
        // 遮罩点击关闭
        mask.on(Node.EventType.TOUCH_END, () => {
            this.close();
        });
        return mask;
    }

    // ==================== Toast ====================

    /**
     * 显示 Toast 消息
     * @param message 消息文本
     * @param duration 显示时长（秒），默认 2
     */
    public toast(message: string, duration: number = 2): void {
        const toastLayer = this._layers.get(UILayer.Toast);
        if (!toastLayer) return;

        const toastNode = this.createToastNode(message);
        toastNode.setParent(toastLayer);

        // 自动消失
        this.scheduleOnce(() => {
            toastNode.destroy();
        }, duration);
    }

    protected createToastNode(message: string): Node {
        const node = new Node('Toast');
        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(500, 60));
        node.setPosition(0, -400, 0);

        // 背景
        const bg = node.addComponent(Sprite);
        bg.sizeMode = Sprite.SizeMode.CUSTOM;
        bg.type = Sprite.Type.SIMPLE;
        bg.color = new Color(0, 0, 0, 200);

        // 文本
        const labelNode = new Node('Label');
        labelNode.setParent(node);
        const label = labelNode.addComponent(Label);
        label.string = message;
        label.fontSize = 24;
        label.lineHeight = 24;
        label.color = new Color(255, 255, 255, 255);
        label.overflow = Overflow.NONE;
        label.horizontalAlign = HorizontalTextAlignment.CENTER;

        return node;
    }

    // ==================== 生命周期 ====================

    onDestroy() {
        if (UIFrame._instance === this) {
            UIFrame._instance = null;
        }
        this.closeAll();
        this._panelCache.forEach(node => node.destroy());
        this._panelCache.clear();
        this._prefabPathMap.clear();
    }
}
