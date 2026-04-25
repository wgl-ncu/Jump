import { _decorator, Component, Node, UITransform, Size, Graphics, Color } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 背景滚动组件 - 纵向卷轴版
 * 绘制从下向上滚动的横向线条效果
 * 支持磁场反转区域氛围（紫色线条）
 */
@ccclass('ScrollingBackground')
export class ScrollingBackground extends Component {

    @property({ tooltip: '滚动速度' })
    public scrollSpeed: number = 300;

    /** 当前Y偏移 */
    private _offsetY: number = 0;

    /** 当前速度 */
    private _currentSpeed: number = 300;

    /** Graphics组件 */
    private _gfx: Graphics | null = null;

    /** 设计尺寸 */
    private readonly DESIGN_W: number = 720;
    private readonly DESIGN_H: number = 1280;

    /** 是否运行中 */
    private _running: boolean = false;

    /** 墙壁宽度 */
    private readonly WALL_W: number = 40;

    /** 当前反转系数 */
    private _reversalFactor: number = 0;

    start() {
        this._currentSpeed = this.scrollSpeed;
        this.createBackground();
    }

    public setRunning(running: boolean) {
        this._running = running;
    }

    public setSpeed(speed: number) {
        this._currentSpeed = speed;
    }

    public setReversalFactor(factor: number) {
        this._reversalFactor = factor;
    }

    private createBackground() {
        const gfxNode = new Node('ScrollLines');
        gfxNode.setParent(this.node);
        const ut = gfxNode.addComponent(UITransform);
        ut.setContentSize(new Size(this.DESIGN_W, this.DESIGN_H));
        this._gfx = gfxNode.addComponent(Graphics);
        this.drawScrollingLines();
    }

    private drawScrollingLines() {
        if (!this._gfx) return;
        const gfx = this._gfx;
        gfx.clear();

        const w = this.DESIGN_W / 2;
        const h = this.DESIGN_H / 2;
        const wallW = this.WALL_W;

        // 颜色随反转系数变化
        const normalColor = new Color(40, 40, 70, 40);
        const reversedColor = new Color(60, 30, 80, 50);
        const lineColor = this.lerpColor(normalColor, reversedColor, this._reversalFactor);

        // 绘制向上滚动的横线（在游戏区域内）
        const lineGap = 50;
        const totalLines = Math.ceil(this.DESIGN_H / lineGap) + 2;

        gfx.strokeColor = lineColor;
        gfx.lineWidth = this._reversalFactor > 0.3 ? 0.8 : 0.5;

        for (let i = -1; i < totalLines; i++) {
            let y = -h + i * lineGap + (this._offsetY % lineGap);
            // 只在游戏区域（不含墙）画线
            gfx.moveTo(-w + wallW, y);
            gfx.lineTo(w - wallW, y);
        }
        gfx.stroke();

        // 绘制纵向参考线（静止）
        const vNormalColor = new Color(35, 35, 60, 25);
        const vReversedColor = new Color(50, 25, 70, 30);
        gfx.strokeColor = this.lerpColor(vNormalColor, vReversedColor, this._reversalFactor);
        gfx.lineWidth = 0.5;
        const vLineGap = 80;
        const playableLeft = -w + wallW;
        const playableRight = w - wallW;
        for (let x = playableLeft; x <= playableRight; x += vLineGap) {
            gfx.moveTo(x, -h);
            gfx.lineTo(x, h);
        }
        gfx.stroke();
    }

    private lerpColor(a: Color, b: Color, t: number): Color {
        return new Color(
            Math.floor(a.r + (b.r - a.r) * t),
            Math.floor(a.g + (b.g - a.g) * t),
            Math.floor(a.b + (b.b - a.b) * t),
            Math.floor(a.a + (b.a - a.a) * t)
        );
    }

    update(dt: number) {
        const speed = this._running ? this._currentSpeed : this._currentSpeed * 0.15;
        this._offsetY += speed * dt;

        if (this._offsetY >= 50) {
            this._offsetY -= 50;
        }

        this.drawScrollingLines();
    }
}
