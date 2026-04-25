import { _decorator, Component, Node, Graphics, Color, UITransform, Size } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 积分道具 - 拾取增加积分
 * 生成在障碍物行之间的安全位置
 */
@ccclass('Coin')
export class Coin extends Component {

    /** 道具分值 */
    private _value: number = 3;
    public get value(): number { return this._value; }
    public set value(v: number) { this._value = v; }

    /** 移动速度 */
    private _speed: number = 300;
    public set speed(v: number) { this._speed = v; }

    /** 是否已被拾取 */
    private _collected: boolean = false;
    public get collected(): boolean { return this._collected; }

    /** 是否已离开屏幕 */
    private _outOfScreen: boolean = false;
    public get outOfScreen(): boolean { return this._outOfScreen; }

    /** 拾取半径 */
    private _radius: number = 18;

    /** 旋转角度 */
    private _angle: number = 0;

    /** 动画计时 */
    private _animTimer: number = 0;

    start() {
        this.createVisual();
    }

    private createVisual() {
        const gfxNode = new Node('CoinGfx');
        gfxNode.setParent(this.node);
        gfxNode.addComponent(UITransform).setContentSize(new Size(40, 40));
        const gfx = gfxNode.addComponent(Graphics);
        this.drawCoin(gfx);
    }

    private drawCoin(gfx: Graphics) {
        gfx.clear();
        const r = this._radius;

        // 外圈发光
        gfx.fillColor = new Color(255, 220, 50, 50);
        gfx.circle(0, 0, r + 6);
        gfx.fill();

        // 主体
        gfx.fillColor = new Color(255, 210, 30, 255);
        gfx.circle(0, 0, r);
        gfx.fill();

        // 边框
        gfx.strokeColor = new Color(255, 180, 0, 255);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, r);
        gfx.stroke();

        // 内圈
        gfx.fillColor = new Color(255, 240, 100, 255);
        gfx.circle(0, 0, r * 0.6);
        gfx.fill();

        // 星形标记
        gfx.fillColor = new Color(255, 200, 0, 255);
        const sr = r * 0.35;
        gfx.moveTo(0, sr);
        gfx.lineTo(sr * 0.3, sr * 0.3);
        gfx.lineTo(sr, 0);
        gfx.lineTo(sr * 0.3, -sr * 0.3);
        gfx.lineTo(0, -sr);
        gfx.lineTo(-sr * 0.3, -sr * 0.3);
        gfx.lineTo(-sr, 0);
        gfx.lineTo(-sr * 0.3, sr * 0.3);
        gfx.close();
        gfx.fill();
    }

    update(dt: number) {
        if (this._collected || this._outOfScreen) return;

        // 向上移动（与障碍物同步）
        const pos = this.node.position;
        this.node.setPosition(pos.x, pos.y + this._speed * dt, pos.z);

        // 缓慢旋转动画
        this._animTimer += dt;
        this._angle = this._animTimer * 90; // 每秒90度
        this.node.angle = this._angle;

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
        this.scheduleOnce(() => {
            this.node.destroy();
        }, 0.1);

        // 放大效果
        this.node.setScale(1.5, 1.5, 1);

        // 透明
        const gfxNode = this.node.getChildByName('CoinGfx');
        if (gfxNode) {
            const gfx = gfxNode.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = new Color(255, 255, 100, 150);
                gfx.circle(0, 0, 25);
                gfx.fill();
            }
        }
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
        this._angle = 0;
        this._animTimer = 0;
    }
}
