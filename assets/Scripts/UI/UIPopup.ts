import { _decorator, Node, UITransform, Size, Sprite, Color, Label, Button, Overflow, HorizontalTextAlignment, tween, Vec3 } from 'cc';
import { UIPanel } from './UIPanel';
import { UIFrame } from './UIFrame';
import { UILayer } from './UIFrame';

const { ccclass } = _decorator;

/**
 * 弹窗结果
 */
export enum PopupResult {
    Confirm = 'confirm',
    Cancel = 'cancel',
}

/**
 * UIPopup - 弹窗基类
 *
 * 适用于需要用户确认/取消的模态弹窗。
 * 内置遮罩、标题栏、确认/取消按钮。
 *
 * 使用示例：
 * ```ts
 * // 简单确认弹窗
 * const popup = UIPopup.show({
 *     title: '提示',
 *     message: '确定要退出吗？',
 *     showCancel: true,
 *     onConfirm: () => { ... },
 *     onCancel: () => { ... },
 * });
 * ```
 */
@ccclass('UIPopup')
export class UIPopup extends UIPanel {

    protected get cacheable(): boolean {
        return false; // 弹窗默认不缓存
    }

    // UI 引用
    private _titleLabel: Label | null = null;
    private _messageLabel: Label | null = null;
    private _confirmBtn: Node | null = null;
    private _cancelBtn: Node | null = null;

    // 回调
    private _onConfirm: (() => void) | null = null;
    private _onCancel: (() => void) | null = null;

    // ==================== 静态工厂方法 ====================

    /**
     * 快速显示一个弹窗
     */
    public static show(options: {
        title?: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        showCancel?: boolean;
        onConfirm?: () => void;
        onCancel?: () => void;
    }): UIPopup {
        // 创建弹窗节点
        const node = new Node('UIPopup');
        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(720, 1280));

        const popup = node.addComponent(UIPopup);
        popup.buildPopupUI(options);

        // 添加到 Popup 层
        const frame = UIFrame.getInstance();
        const popupLayer = frame.getLayer(UILayer.Popup);
        if (popupLayer) {
            node.setParent(popupLayer);
        }

        return popup;
    }

    // ==================== 生命周期 ====================

    protected onPanelInit(): void {
        // buildPopupUI 已在 show() 中调用
    }

    protected onPanelOpen(data?: any): void {
        this.node.active = true;
        this.playOpenAnimation();
    }

    protected onPanelClose(): void {
        this.playCloseAnimation();
    }

    // ==================== 构建 UI ====================

    private buildPopupUI(options: {
        title?: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        showCancel?: boolean;
        onConfirm?: () => void;
        onCancel?: () => void;
    }): void {
        const { title = '提示', message, confirmText = '确认', cancelText = '取消', showCancel = true, onConfirm, onCancel } = options;

        this._onConfirm = onConfirm || null;
        this._onCancel = onCancel || null;

        // 全屏遮罩
        const mask = new Node('_Mask');
        mask.setParent(this.node);
        mask.setSiblingIndex(0);
        const maskUT = mask.addComponent(UITransform);
        maskUT.setContentSize(new Size(720, 1280));
        const maskSprite = mask.addComponent(Sprite);
        maskSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        maskSprite.type = Sprite.Type.SIMPLE;
        maskSprite.color = new Color(0, 0, 0, 150);
        mask.on(Node.EventType.TOUCH_END, () => {
            this.doCancel();
        });

        // 弹窗内容框
        const contentBox = new Node('ContentBox');
        contentBox.setParent(this.node);
        const cbUT = contentBox.addComponent(UITransform);
        cbUT.setContentSize(new Size(560, 360));
        const cbSprite = contentBox.addComponent(Sprite);
        cbSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        cbSprite.type = Sprite.Type.SIMPLE;
        cbSprite.color = new Color(40, 40, 60, 255);

        // 标题
        const titleNode = new Node('Title');
        titleNode.setParent(contentBox);
        titleNode.setPosition(0, 130, 0);
        this._titleLabel = titleNode.addComponent(Label);
        this._titleLabel.string = title;
        this._titleLabel.fontSize = 36;
        this._titleLabel.lineHeight = 36;
        this._titleLabel.color = new Color(255, 220, 100, 255);
        this._titleLabel.overflow = Overflow.NONE;
        this._titleLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        // 消息
        const msgNode = new Node('Message');
        msgNode.setParent(contentBox);
        msgNode.setPosition(0, 30, 0);
        this._messageLabel = msgNode.addComponent(Label);
        this._messageLabel.string = message;
        this._messageLabel.fontSize = 28;
        this._messageLabel.lineHeight = 40;
        this._messageLabel.color = new Color(220, 220, 220, 255);
        this._messageLabel.overflow = Overflow.RESIZE_HEIGHT;
        this._messageLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
        const msgUT = msgNode.getComponent(UITransform)!;
        msgUT.setContentSize(new Size(480, 120));

        // 按钮区域
        const btnY = -120;
        const btnSpacing = 160;

        if (showCancel) {
            this._cancelBtn = this.createButton(cancelText, new Color(120, 120, 140, 255), contentBox, -btnSpacing / 2, btnY);
            this._cancelBtn.on(Node.EventType.TOUCH_END, () => this.doCancel());
        }

        const confirmX = showCancel ? btnSpacing / 2 : 0;
        this._confirmBtn = this.createButton(confirmText, new Color(80, 180, 80, 255), contentBox, confirmX, btnY);
        this._confirmBtn.on(Node.EventType.TOUCH_END, () => this.doConfirm());
    }

    private createButton(text: string, color: Color, parent: Node, x: number, y: number): Node {
        const btnNode = new Node('Button');
        btnNode.setParent(parent);
        btnNode.setPosition(x, y, 0);
        const btnUT = btnNode.addComponent(UITransform);
        btnUT.setContentSize(new Size(200, 56));
        const btnSprite = btnNode.addComponent(Sprite);
        btnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        btnSprite.type = Sprite.Type.SIMPLE;
        btnSprite.color = color;

        const labelNode = new Node('Label');
        labelNode.setParent(btnNode);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 24;
        label.lineHeight = 24;
        label.color = new Color(255, 255, 255, 255);
        label.overflow = Overflow.NONE;
        label.horizontalAlign = HorizontalTextAlignment.CENTER;

        const button = btnNode.addComponent(Button);
        button.transition = Button.Transition.COLOR;
        button.normalColor = color;
        button.pressedColor = new Color(
            Math.max(0, color.r - 30),
            Math.max(0, color.g - 30),
            Math.max(0, color.b - 30),
            255
        );

        return btnNode;
    }

    // ==================== 动画 ====================

    protected playOpenAnimation(): void {
        this.node.setScale(0.8, 0.8, 1);
        tween(this.node)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    protected playCloseAnimation(): void {
        tween(this.node)
            .to(0.15, { scale: new Vec3(0.8, 0.8, 1) }, { easing: 'backIn' })
            .call(() => {
                this.node.destroy();
            })
            .start();
    }

    // ==================== 操作 ====================

    private doConfirm(): void {
        this._onConfirm?.();
        this.dismiss();
    }

    private doCancel(): void {
        this._onCancel?.();
        this.dismiss();
    }

    /** 关闭弹窗 */
    public dismiss(): void {
        this.playCloseAnimation();
    }
}
