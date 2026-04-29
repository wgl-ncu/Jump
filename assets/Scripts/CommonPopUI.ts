import { _decorator, Button, Label, Node, Sprite, SpriteFrame } from 'cc';
import { UIPanel } from './UI/UIPanel';
import { UIFrame, UILayer } from './UI/UIFrame';

const { ccclass } = _decorator;

export enum CommonPopUILayout {
    Text = 'text',
    ImageText = 'image-text',
}

export interface CommonPopUIButtonOption {
    text?: string;
    icon?: SpriteFrame | null;
    onClick?: () => void;
}

export interface CommonPopUIOpenOptions {
    layout?: CommonPopUILayout;
    text?: string;
    icon?: SpriteFrame | null;
    buttons?: CommonPopUIButtonOption[];
    onClose?: () => void;
}

@ccclass('CommonPopUI')
export class CommonPopUI extends UIPanel {

    private static readonly ROOT_PATHS = ['Bg', ''];

    private _closeButton: Button | null = null;
    private _contentLabel: Label | null = null;
    private _contentLabelAndIcon: Node | null = null;
    private _content2Label: Label | null = null;
    private _contentIcon: Sprite | null = null;
    private _buttonsRoot: Node | null = null;
    private _button1: Button | null = null;
    private _button2: Button | null = null;
    private _buttonLabel1: Label | null = null;
    private _buttonLabel2: Label | null = null;
    private _buttonIcon1: Sprite | null = null;
    private _buttonIcon2: Sprite | null = null;

    private _buttonConfigs: CommonPopUIButtonOption[] = [];
    private _onClose: (() => void) | null = null;
    private _isClosing: boolean = false;

    protected get layer(): UILayer {
        return UILayer.Popup;
    }

    protected get cacheable(): boolean {
        return false;
    }

    public static show(options: CommonPopUIOpenOptions): void {
        UIFrame.getInstance().open('CommonPopUI', {
            cache: false,
            data: options,
        });
    }

    protected onPanelInit(): void {
        this._closeButton = this.getComponentFromPaths('Top/CloseBtn', Button);
        this._contentLabel = this.getComponentFromPaths('Content/ContentLabel', Label);
        this._contentLabelAndIcon = this.getNodeFromPaths('Content/ContentLabelAndIcon');
        this._content2Label = this.getComponentFromPaths('Content/ContentLabelAndIcon/Content2Label', Label);
        this._contentIcon = this.getComponentFromPaths('Content/ContentLabelAndIcon/ContentIcon', Sprite);
        this._buttonsRoot = this.getNodeFromPaths('Btns');
        this._button1 = this.getComponentFromPaths('Btns/Button1', Button);
        this._button2 = this.getComponentFromPaths('Btns/Button2', Button);
        this._buttonLabel1 = this.getComponentFromPaths('Btns/Button1/Size/BtnLabel1', Label);
        this._buttonLabel2 = this.getComponentFromPaths('Btns/Button2/Size/BtnLabel2', Label);
        this._buttonIcon1 = this.getComponentFromPaths('Btns/Button1/Size/BtnIcon1', Sprite);
        this._buttonIcon2 = this.getComponentFromPaths('Btns/Button2/Size/BtnIcon2', Sprite);

        this._closeButton?.node.off(Button.EventType.CLICK, this.handleClosePressed, this);
        this._closeButton?.node.on(Button.EventType.CLICK, this.handleClosePressed, this);
        this._button1?.node.off(Button.EventType.CLICK, this.handleButton1Pressed, this);
        this._button1?.node.on(Button.EventType.CLICK, this.handleButton1Pressed, this);
        this._button2?.node.off(Button.EventType.CLICK, this.handleButton2Pressed, this);
        this._button2?.node.on(Button.EventType.CLICK, this.handleButton2Pressed, this);

        this.node.active = false;
    }

    protected onPanelOpen(data?: CommonPopUIOpenOptions): void {
        super.onPanelOpen(data);

        const options = data || {};
        const buttons = (options.buttons || []).slice(0, 2);

        this._isClosing = false;
        this._onClose = options.onClose || null;
        this._buttonConfigs = buttons;

        this.applyContent(options);
        this.applyButtons(buttons);
    }

    private handleClosePressed(): void {
        this.requestClose();
    }

    private handleButton1Pressed(): void {
        this.handleButtonPressed(0);
    }

    private handleButton2Pressed(): void {
        this.handleButtonPressed(1);
    }

    private handleButtonPressed(index: number): void {
        const config = this._buttonConfigs[index];
        if (!config) {
            return;
        }

        this.requestClose(config.onClick || null);
    }

    private requestClose(afterClose: (() => void) | null = null): void {
        if (this._isClosing) {
            return;
        }

        this._isClosing = true;
        const onClose = this._onClose;
        this._onClose = null;

        UIFrame.getInstance().closePanel('CommonPopUI');
        this.safeInvoke(afterClose);
        this.safeInvoke(onClose);
    }

    private applyContent(options: CommonPopUIOpenOptions): void {
        const layout = options.layout || (options.icon ? CommonPopUILayout.ImageText : CommonPopUILayout.Text);
        const text = options.text || '';

        const isTextOnly = layout === CommonPopUILayout.Text;

        if (this._contentLabel?.node) {
            this._contentLabel.node.active = isTextOnly;
            this._contentLabel.string = text;
        }

        if (this._contentLabelAndIcon) {
            this._contentLabelAndIcon.active = !isTextOnly;
        }

        if (!isTextOnly) {
            if (this._content2Label) {
                this._content2Label.string = text;
            }

            if (this._contentIcon?.node) {
                const spriteFrame = options.icon || null;
                this._contentIcon.node.active = !!spriteFrame;
                this._contentIcon.spriteFrame = spriteFrame;
            }
        }
    }

    private applyButtons(buttons: CommonPopUIButtonOption[]): void {
        if (!this._buttonsRoot) {
            return;
        }

        this._buttonsRoot.active = buttons.length > 0;

        this.configureButton(this._button1, this._buttonLabel1, this._buttonIcon1, buttons[0] || null);
        this.configureButton(this._button2, this._buttonLabel2, this._buttonIcon2, buttons[1] || null);

        if (this._button1?.node) {
            this._button1.node.active = buttons.length >= 1;
            this._button1.node.setPosition(buttons.length === 1 ? 0 : -85, 0, 0);
        }

        if (this._button2?.node) {
            this._button2.node.active = buttons.length >= 2;
            this._button2.node.setPosition(85, 0, 0);
        }
    }

    private configureButton(
        button: Button | null,
        label: Label | null,
        icon: Sprite | null,
        config: CommonPopUIButtonOption | null,
    ): void {
        if (!button?.node) {
            return;
        }

        button.node.active = !!config;
        if (!config) {
            return;
        }

        if (label) {
            label.string = config.text || '';
        }

        if (icon?.node) {
            const spriteFrame = config.icon || null;
            icon.node.active = !!spriteFrame;
            icon.spriteFrame = spriteFrame;
        }
    }

    private safeInvoke(callback: (() => void) | null): void {
        if (!callback) {
            return;
        }

        try {
            callback();
        } catch (error) {
            console.error('[CommonPopUI] 回调执行失败', error);
        }
    }

    private getNodeFromPaths(relativePath: string): Node | null {
        for (const rootPath of CommonPopUI.ROOT_PATHS) {
            const fullPath = rootPath ? `${rootPath}/${relativePath}` : relativePath;
            const node = this.find(fullPath);
            if (node) {
                return node;
            }
        }

        return null;
    }

    private getComponentFromPaths<T>(relativePath: string, type: new (...args: any[]) => T): T | null {
        for (const rootPath of CommonPopUI.ROOT_PATHS) {
            const fullPath = rootPath ? `${rootPath}/${relativePath}` : relativePath;
            const component = this.getComponentAt(fullPath, type);
            if (component) {
                return component;
            }
        }

        return null;
    }
}