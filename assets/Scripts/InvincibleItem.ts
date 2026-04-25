import { _decorator, Component, Node, Graphics, Color, UITransform, Size } from 'cc';
const { ccclass } = _decorator;

/**
 * 无敌道具 - 拾取后获得10秒无敌时间
 * 生成在障碍物行之间的安全位置
 */
@ccclass('InvincibleItem')
export class InvincibleItem extends Component {

    /** 无敌持续时间（秒） */
    private _duration: number = 10;
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
        const gfxNode = new Node('InvincibleGfx');
        gfxNode.setParent(this.node);
        gfxNode.addComponent(UITransform).setContentSize(new Size(50, 50));
        const gfx = gfxNode.addComponent(Graphics);
        this.drawItem(gfx);
    }

    private drawItem(gfx: Graphics) {
        gfx.clear();
        const r = this._radius;

        // 外圈脉冲发光
        const pulseAlpha = Math.floor(40 + 30 * Math.sin(this._animTimer * 4));
        gfx.fillColor = new Color(100, 220, 255, pulseAlpha);
        gfx.circle(0, 0, r + 10);
        gfx.fill();

        // 主体 - 青蓝色圆形
        gfx.fillColor = new Color(60, 200, 255, 255);
        gfx.circle(0, 0, r);
        gfx.fill();

        // 边框
        gfx.strokeColor = new Color(30, 160, 220, 255);
        gfx.lineWidth = 2.5;
        gfx.circle(0, 0, r);
        gfx.stroke();

        // 内圈
        gfx.fillColor = new Color(150, 235, 255, 255);
        gfx.circle(0, 0, r * 0.6);
        gfx.fill();

        // 盾牌图标
        gfx.fillColor = new Color(255, 255, 255, 230);
        const sr = r * 0.45;
        // 盾牌外形
        gfx.moveTo(0, sr);
        gfx.bezierCurveTo(sr * 0.8, sr * 0.8, sr, sr * 0.2, sr, -sr * 0.1);
        gfx.bezierCurveTo(sr, -sr * 0.5, sr * 0.5, -sr * 0.9, 0, -sr);
        gfx.bezierCurveTo(-sr * 0.5, -sr * 0.9, -sr, -sr * 0.5, -sr, -sr * 0.1);
        gfx.bezierCurveTo(-sr, sr * 0.2, -sr * 0.8, sr * 0.8, 0, sr);
        gfx.close();
        gfx.fill();

        // 盾牌内部高光
        gfx.fillColor = new Color(60, 200, 255, 100);
        gfx.moveTo(0, sr * 0.6);
        gfx.bezierCurveTo(sr * 0.4, sr * 0.5, sr * 0.5, sr * 0.1, sr * 0.5, -sr * 0.1);
        gfx.bezierCurveTo(sr * 0.5, -sr * 0.4, sr * 0.2, -sr * 0.7, 0, -sr * 0.7);
        gfx.bezierCurveTo(-sr * 0.2, -sr * 0.7, -sr * 0.5, -sr * 0.4, -sr * 0.5, -sr * 0.1);
        gfx.bezierCurveTo(-sr * 0.5, sr * 0.1, -sr * 0.4, sr * 0.5, 0, sr * 0.6);
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
        this._pulseScale = 1 + 0.1 * Math.sin(this._animTimer * 3);
        this.node.setScale(this._pulseScale, this._pulseScale, 1);

        // 重绘以更新脉冲效果
        const gfxNode = this.node.getChildByName('InvincibleGfx');
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
        const gfxNode = this.node.getChildByName('InvincibleGfx');
        if (gfxNode) {
            const gfx = gfxNode.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = new Color(100, 230, 255, 200);
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
