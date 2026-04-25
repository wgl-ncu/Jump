import { _decorator, Component, Node, Sprite, Color, UITransform, Size, Graphics } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 磁场视觉区域 - 纵向卷轴版
 * 左侧为N极（红色），右侧为S极（蓝色）
 * 支持磁场反转视觉
 */
@ccclass('MagneticField')
export class MagneticField extends Component {

    @property({ tooltip: 'N极区域节点' })
    public northZone: Node | null = null;

    @property({ tooltip: 'S极区域节点' })
    public southZone: Node | null = null;

    /** N极颜色 */
    private readonly NORTH_COLOR = new Color(255, 40, 40, 12);
    /** S极颜色 */
    private readonly SOUTH_COLOR = new Color(40, 40, 255, 12);
    /** 反转N极颜色（淡紫蓝） */
    private readonly REVERSED_NORTH_COLOR = new Color(80, 60, 220, 18);
    /** 反转S极颜色（淡紫红） */
    private readonly REVERSED_SOUTH_COLOR = new Color(220, 60, 80, 18);

    /** 分界线X位置 */
    private _dividerX: number = 0;

    /** 场景宽度 */
    private _fieldWidth: number = 620;

    /** 透视网格节点 */
    private _gridNode: Node | null = null;

    /** 当前反转系数 */
    private _reversalFactor: number = 0;

    /** 脉冲动画时间 */
    private _pulseTime: number = 0;

    start() {
        this.updateVisual();
        this.createFieldLines();
    }

    public init(width: number, dividerX: number = 0) {
        this._fieldWidth = width;
        this._dividerX = dividerX;
        this.updateVisual();
    }

    /**
     * 设置反转系数，更新视觉
     */
    public setReversalFactor(factor: number) {
        this._reversalFactor = factor;
        this.updateReversalVisual();
    }

    private updateVisual() {
        const halfWidth = this._fieldWidth / 2;

        if (this.northZone) {
            const uiTransform = this.northZone.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.setContentSize(new Size(halfWidth, 1400));
            }
            this.northZone.setPosition(this._dividerX - halfWidth / 2, 0, 0);
            const sprite = this.northZone.getComponent(Sprite);
            if (sprite) sprite.color = this.NORTH_COLOR;
        }

        if (this.southZone) {
            const uiTransform = this.southZone.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.setContentSize(new Size(halfWidth, 1400));
            }
            this.southZone.setPosition(this._dividerX + halfWidth / 2, 0, 0);
            const sprite = this.southZone.getComponent(Sprite);
            if (sprite) sprite.color = this.SOUTH_COLOR;
        }
    }

    /**
     * 更新反转视觉 - 颜色插值
     */
    private updateReversalVisual() {
        const lerpColor = (a: Color, b: Color, t: number): Color => {
            return new Color(
                Math.floor(a.r + (b.r - a.r) * t),
                Math.floor(a.g + (b.g - a.g) * t),
                Math.floor(a.b + (b.b - a.b) * t),
                Math.floor(a.a + (b.a - a.a) * t)
            );
        };

        const t = this._reversalFactor;

        // N极区域反转时变蓝紫
        if (this.northZone) {
            const sprite = this.northZone.getComponent(Sprite);
            if (sprite) {
                sprite.color = lerpColor(this.NORTH_COLOR, this.REVERSED_NORTH_COLOR, t);
            }
        }

        // S极区域反转时变红紫
        if (this.southZone) {
            const sprite = this.southZone.getComponent(Sprite);
            if (sprite) {
                sprite.color = lerpColor(this.SOUTH_COLOR, this.REVERSED_SOUTH_COLOR, t);
            }
        }
    }

    /**
     * 创建磁场分界线效果
     */
    private createFieldLines() {
        this._gridNode = new Node('FieldLines');
        this._gridNode.setParent(this.node);
        const ut = this._gridNode.addComponent(UITransform);
        ut.setContentSize(new Size(720, 1280));
        const gfx = this._gridNode.addComponent(Graphics);

        const cx = this._dividerX;
        const h = 640;

        // 绘制N/S极边界高亮线（竖线）
        gfx.strokeColor = new Color(200, 100, 100, 60);
        gfx.lineWidth = 2;
        gfx.moveTo(cx, -h);
        gfx.lineTo(cx, h);
        gfx.stroke();

        // 绘制从分界线向左右扩散的横线
        gfx.strokeColor = new Color(60, 60, 100, 25);
        gfx.lineWidth = 0.5;

        const lineCount = 16;
        for (let i = 1; i <= lineCount; i++) {
            const t = i / lineCount;
            const halfW = this._fieldWidth / 2 * t;
            gfx.moveTo(cx - halfW, -h + i * 80);
            gfx.lineTo(cx + halfW, -h + i * 80);
        }
        gfx.stroke();
    }

    update(dt: number) {
        // 反转时中线脉冲效果
        if (this._reversalFactor > 0.05) {
            this._pulseTime += dt * 3;
        }
    }

    public getDividerX(): number {
        return this._dividerX;
    }
}
