import {
    Node, UITransform, Size, Sprite, Color, Label, Button, Graphics,
    Overflow, HorizontalTextAlignment, VerticalTextAlignment, Widget,
    Layout, Vec3, director, view
} from 'cc';

/**
 * UIBuilder - UI 元素快速构建工具
 *
 * 消除项目中大量重复的 UI 创建代码，提供声明式的构建接口。
 *
 * 使用示例：
 * ```ts
 * // 创建一个标题标签
 * const title = UIBuilder.label('Hello', { fontSize: 48, color: Color.WHITE });
 * title.node.setParent(parentNode);
 *
 * // 创建一个按钮
 * const btn = UIBuilder.button('开始游戏', { width: 280, height: 80, color: new Color(100, 200, 100) });
 * btn.node.setParent(parentNode);
 * btn.node.on(Node.EventType.TOUCH_END, () => { ... });
 *
 * // 链式创建面板
 * UIBuilder.panel(parent)
 *   .background(new Color(0, 0, 0, 200))
 *   .title('设置', 42, Color.YELLOW)
 *   .build();
 * ```
 */
export class UIBuilder {

    /** 设计分辨率 */
    static DESIGN_WIDTH = 720;
    static DESIGN_HEIGHT = 1280;

    // ==================== 基础节点 ====================

    /**
     * 创建基础节点
     */
    static node(name: string, parent?: Node, options?: {
        width?: number;
        height?: number;
        position?: Vec3;
    }): Node {
        const node = new Node(name);
        if (parent) node.setParent(parent);

        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(options?.width || 0, options?.height || 0));

        if (options?.position) {
            node.setPosition(options.position);
        }

        return node;
    }

    // ==================== Label ====================

    /**
     * 创建标签
     */
    static label(text: string, options: {
        fontSize?: number;
        color?: Color;
        overflow?: Overflow;
        align?: HorizontalTextAlignment;
        width?: number;
        height?: number;
        lineHeight?: number;
        parent?: Node;
        position?: Vec3;
        name?: string;
    } = {}): Label {
        const {
            fontSize = 24,
            color = Color.WHITE,
            overflow: overflowMode = Overflow.NONE,
            align = HorizontalTextAlignment.CENTER,
            width = 0,
            height = 0,
            lineHeight,
            parent,
            position,
            name = 'Label',
        } = options;

        const node = new Node(name);
        if (parent) node.setParent(parent);
        if (position) node.setPosition(position);

        const ut = node.addComponent(UITransform);
        if (width > 0 || height > 0) {
            ut.setContentSize(new Size(width || 0, height || 0));
        }

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = lineHeight || fontSize;
        label.color = color;
        label.overflow = overflowMode;
        label.horizontalAlign = align;

        return label;
    }

    // ==================== Sprite ====================

    /**
     * 创建纯色精灵
     */
    static sprite(options: {
        width: number;
        height: number;
        color?: Color;
        parent?: Node;
        position?: Vec3;
        name?: string;
    }): Sprite {
        const {
            width,
            height,
            color = Color.WHITE,
            parent,
            position,
            name = 'Sprite',
        } = options;

        const node = new Node(name);
        if (parent) node.setParent(parent);
        if (position) node.setPosition(position);

        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(width, height));

        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.color = color;

        return sprite;
    }

    // ==================== Button ====================

    /**
     * 创建按钮（纯色背景 + 文字）
     */
    static button(text: string, options: {
        width?: number;
        height?: number;
        color?: Color;
        pressedColor?: Color;
        fontSize?: number;
        fontColor?: Color;
        parent?: Node;
        position?: Vec3;
        name?: string;
    } = {}): { node: Node; button: Button; label: Label } {
        const {
            width = 240,
            height = 64,
            color = new Color(80, 160, 80, 255),
            pressedColor,
            fontSize = 28,
            fontColor = Color.WHITE,
            parent,
            position,
            name = 'Button',
        } = options;

        const btnNode = new Node(name);
        if (parent) btnNode.setParent(parent);
        if (position) btnNode.setPosition(position);

        const ut = btnNode.addComponent(UITransform);
        ut.setContentSize(new Size(width, height));

        const sprite = btnNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.color = color;

        const labelNode = new Node('Label');
        labelNode.setParent(btnNode);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize;
        label.color = fontColor;
        label.overflow = Overflow.NONE;
        label.horizontalAlign = HorizontalTextAlignment.CENTER;

        const button = btnNode.addComponent(Button);
        button.transition = Button.Transition.COLOR;
        button.normalColor = color;
        button.pressedColor = pressedColor || new Color(
            Math.max(0, color.r - 40),
            Math.max(0, color.g - 40),
            Math.max(0, color.b - 40),
            255
        );
        button.hoverColor = new Color(
            Math.min(255, color.r + 20),
            Math.min(255, color.g + 20),
            Math.min(255, color.b + 20),
            255
        );

        return { node: btnNode, button, label };
    }

    // ==================== Graphics ====================

    /**
     * 创建 Graphics 绘制节点
     */
    static graphics(options: {
        width?: number;
        height?: number;
        parent?: Node;
        position?: Vec3;
        name?: string;
    }): Graphics {
        const { width = 0, height = 0, parent, position, name = 'Graphics' } = options;

        const node = new Node(name);
        if (parent) node.setParent(parent);
        if (position) node.setPosition(position);

        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(width, height));

        return node.addComponent(Graphics);
    }

    // ==================== 九宫格圆角矩形 ====================

    /**
     * 用 Graphics 绘制圆角矩形背景
     */
    static roundRect(parent: Node, options: {
        width: number;
        height: number;
        radius?: number;
        fillColor?: Color;
        strokeColor?: Color;
        lineWidth?: number;
        position?: Vec3;
        name?: string;
    }): Graphics {
        const {
            width,
            height,
            radius = 12,
            fillColor,
            strokeColor,
            lineWidth = 2,
            position,
            name = 'RoundRect',
        } = options;

        const gfxNode = new Node(name);
        gfxNode.setParent(parent);
        if (position) gfxNode.setPosition(position);

        const ut = gfxNode.addComponent(UITransform);
        ut.setContentSize(new Size(width, height));

        const gfx = gfxNode.addComponent(Graphics);
        const hw = width / 2;
        const hh = height / 2;
        const r = Math.min(radius, hw, hh);

        gfx.roundRect(-hw, -hh, width, height, r);

        if (fillColor) {
            gfx.fillColor = fillColor;
            gfx.fill();
        }
        if (strokeColor) {
            gfx.strokeColor = strokeColor;
            gfx.lineWidth = lineWidth;
            gfx.stroke();
        }

        return gfx;
    }

    // ==================== 面板构建器 ====================

    /**
     * 创建面板构建器（链式调用）
     */
    static panel(parent: Node): PanelBuilder {
        return new PanelBuilder(parent);
    }
}

/**
 * 面板构建器 - 链式 API 构建复杂面板
 *
 * ```ts
 * UIBuilder.panel(parent)
 *   .size(560, 400)
 *   .background(new Color(30, 30, 50, 255))
 *   .title('设置', 36, Color.YELLOW)
 *   .content((content) => {
 *       UIBuilder.label('音量', { parent: content });
 *   })
 *   .build();
 * ```
 */
export class PanelBuilder {
    private _parent: Node;
    private _name: string = 'Panel';
    private _width: number = 560;
    private _height: number = 400;
    private _bgColor: Color = new Color(30, 30, 50, 255);
    private _radius: number = 16;
    private _titleText?: string;
    private _titleFontSize: number = 36;
    private _titleColor: Color = Color.WHITE;
    private _contentBuilder?: (content: Node) => void;
    private _position?: Vec3;

    constructor(parent: Node) {
        this._parent = parent;
    }

    name(name: string): PanelBuilder {
        this._name = name;
        return this;
    }

    size(width: number, height: number): PanelBuilder {
        this._width = width;
        this._height = height;
        return this;
    }

    position(pos: Vec3): PanelBuilder {
        this._position = pos;
        return this;
    }

    background(color: Color): PanelBuilder {
        this._bgColor = color;
        return this;
    }

    radius(r: number): PanelBuilder {
        this._radius = r;
        return this;
    }

    title(text: string, fontSize: number = 36, color: Color = Color.WHITE): PanelBuilder {
        this._titleText = text;
        this._titleFontSize = fontSize;
        this._titleColor = color;
        return this;
    }

    content(builder: (content: Node) => void): PanelBuilder {
        this._contentBuilder = builder;
        return this;
    }

    build(): Node {
        const panelNode = new Node(this._name);
        panelNode.setParent(this._parent);
        if (this._position) panelNode.setPosition(this._position);

        const panelUT = panelNode.addComponent(UITransform);
        panelUT.setContentSize(new Size(this._width, this._height));

        // 圆角背景
        UIBuilder.roundRect(panelNode, {
            width: this._width,
            height: this._height,
            radius: this._radius,
            fillColor: this._bgColor,
        });

        // 标题
        if (this._titleText) {
            const titleY = this._height / 2 - 50;
            UIBuilder.label(this._titleText, {
                parent: panelNode,
                position: new Vec3(0, titleY, 0),
                fontSize: this._titleFontSize,
                color: this._titleColor,
            });
        }

        // 内容区域
        if (this._contentBuilder) {
            const contentNode = UIBuilder.node('Content', panelNode, {
                width: this._width - 40,
                height: this._height - 100,
                position: new Vec3(0, -30, 0),
            });
            this._contentBuilder(contentNode);
        }

        return panelNode;
    }
}
