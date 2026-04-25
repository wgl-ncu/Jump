import { _decorator, Component, Node, Graphics, Color, UITransform, Size } from 'cc';
const { ccclass } = _decorator;

/**
 * 冲刺道具 - 拾取后快速冲刺5秒
 * 期间撞飞障碍物、自动拾取路径上道具
 */
@ccclass('DashItem')
export class DashItem extends Component {

    /** 冲刺持续时间（秒） */
    private _duration: number = 5;
    public get duration(): number { return this._duration; }
    public set duration(v: number) { this._duration = v; }

    /** 移动速度 */
    private _speed: number = 300;
    public set speed(v: number) { this._speed = v; }

    /** 是否已被拾取 */
    private _collected: boolean = false;
    public get collected(): boolean { return this._collected; }

    /** 是否已离开屏幕 */
    private _outOfScreen: boolean = false;
    public get outOfScreen(): boolean { return this._outOfScreen; }

    /** 碰撞半径 */
    private _radius: number = 20;

    /** 动画计时 */
    private _animTimer: number = 0;

    /** 脉冲缩放 */
    private _pulseScale: number = 1;

    start() {
        this.createVisual();
    }

    private createVisual() {
        const gfxNode = new Node('DashGfx');
        gfxNode.setParent(this.node);
        gfxNode.addComponent(UITransform).setContentSize(new Size(50, 50));
        const gfx = gfxNode.addComponent(Graphics);
        this.drawItem(gfx);
    }

    private drawItem(gfx: Graphics) {
        gfx.clear();
        const r = this._radius;

        // 外圈脉冲发光 - 橙色
        const pulseAlpha = Math.floor(40 + 30 * Math.sin(this._animTimer * 5));
        gfx.fillColor = new Color(255, 160, 30, pulseAlpha);
        gfx.circle(0, 0, r + 10);
        gfx.fill();

        // 主体 - 橙色圆形
        gfx.fillColor = new Color(255, 150, 30, 255);
        gfx.circle(0, 0, r);
        gfx.fill();

        // 边框
        gfx.strokeColor = new Color(200, 100, 0, 255);
        gfx.lineWidth = 2.5;
        gfx.circle(0, 0, r);
        gfx.stroke();

        // 内圈
        gfx.fillColor = new Color(255, 210, 100, 255);
        gfx.circle(0, 0, r * 0.6);
        gfx.fill();

        // 闪电图标
        gfx.fillColor = new Color(255, 255, 255, 240);
        const sr = r * 0.45;
        // 闪电形状
        gfx.moveTo(sr * 0.1, sr);
        gfx.lineTo(-sr * 0.4, sr * 0.1);
        gfx.lineTo(-sr * 0.05, sr * 0.1);
        gfx.lineTo(-sr * 0.3, -sr);
        gfx.lineTo(sr * 0.4, -sr * 0.1);
        gfx.lineTo(sr * 0.05, -sr * 0.1);
        gfx.close();
        gfx.fill();

        // 闪电内部高光
        gfx.fillColor = new Color(255, 200, 80, 120);
        gfx.moveTo(sr * 0.0, sr * 0.6);
        gfx.lineTo(-sr * 0.2, sr * 0.1);
        gfx.lineTo(sr * 0.0, sr * 0.1);
        gfx.lineTo(-sr * 0.1, -sr * 0.5);
        gfx.lineTo(sr * 0.2, -sr * 0.05);
        gfx.lineTo(sr * 0.0, -sr * 0.05);
        gfx.close();
        gfx.fill();
    }

    update(dt: number) {
        if (this._collected || this._outOfScreen) return;

        // 向上移动（与障碍物同步）
        const pos = this.node.position;
        this.node.setPosition(pos.x, pos.y + this._speed * dt, pos.z);

        // 脉冲动画
        this._animTimer += dt;
        this._pulseScale = 1 + 0.12 * Math.sin(this._animTimer * 4);
        this.node.setScale(this._pulseScale, this._pulseScale, 1);

        // 重绘以更新脉冲效果
        const gfxNode = this.node.getChildByName('DashGfx');
        if (gfxNode) {
            const gfx = gfxNode.getComponent(Graphics);
            if (gfx) this.drawItem(gfx);
        }

        // 离开屏幕
        if (pos.y > 800) {
            this._outOfScreen = true;
        }
    }

    /**
     * 拾取道具
     */
    public collect() {
        if (this._collected) return;
        this._collected = true;

        // 拾取动画：放大后消失
        this.node.setScale(1.8, 1.8, 1);

        // 闪光效果
        const gfxNode = this.node.getChildByName('DashGfx');
        if (gfxNode) {
            const gfx = gfxNode.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = new Color(255, 200, 80, 200);
                gfx.circle(0, 0, 30);
                gfx.fill();
            }
        }

        this.scheduleOnce(() => {
            this.node.destroy();
        }, 0.1);
    }

    /**
     * 获取碰撞半径
     */
    public getCollisionRadius(): number {
        return this._radius;
    }

    public reset() {
        this._collected = false;
        this._outOfScreen = false;
        this._animTimer = 0;
        this._pulseScale = 1;
    }
}
