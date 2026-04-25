import { _decorator, Component, Node, Graphics, Color, UITransform, Size } from 'cc';
const { ccclass } = _decorator;

/**
 * 神秘奖励入口道具 - 拾取后进入奖励房间
 * 奖励房间内铺满积分道具，无障碍物，持续10秒
 */
@ccclass('BonusPortalItem')
export class BonusPortalItem extends Component {

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
    private _radius: number = 22;

    /** 动画计时 */
    private _animTimer: number = 0;

    /** 脉冲缩放 */
    private _pulseScale: number = 1;

    start() {
        this.createVisual();
    }

    private createVisual() {
        const gfxNode = new Node('PortalGfx');
        gfxNode.setParent(this.node);
        gfxNode.addComponent(UITransform).setContentSize(new Size(60, 60));
        const gfx = gfxNode.addComponent(Graphics);
        this.drawItem(gfx);
    }

    private drawItem(gfx: Graphics) {
        gfx.clear();
        const r = this._radius;

        // 最外圈脉冲发光 - 金色
        const pulseAlpha = Math.floor(30 + 25 * Math.sin(this._animTimer * 3));
        gfx.fillColor = new Color(255, 200, 50, pulseAlpha);
        gfx.circle(0, 0, r + 14);
        gfx.fill();

        // 外圈发光 - 紫色
        gfx.fillColor = new Color(180, 100, 255, Math.floor(50 + 30 * Math.sin(this._animTimer * 2)));
        gfx.circle(0, 0, r + 8);
        gfx.fill();

        // 主体 - 紫色圆形
        gfx.fillColor = new Color(160, 80, 240, 255);
        gfx.circle(0, 0, r);
        gfx.fill();

        // 边框 - 金色
        gfx.strokeColor = new Color(255, 200, 50, 255);
        gfx.lineWidth = 3;
        gfx.circle(0, 0, r);
        gfx.stroke();

        // 内圈 - 浅紫
        gfx.fillColor = new Color(200, 150, 255, 255);
        gfx.circle(0, 0, r * 0.65);
        gfx.fill();

        // 旋转的漩涡线条
        const swirlAngle = this._animTimer * 2;
        gfx.strokeColor = new Color(255, 220, 100, 180);
        gfx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const baseAngle = swirlAngle + i * Math.PI * 2 / 3;
            gfx.moveTo(0, 0);
            const segments = 8;
            for (let s = 1; s <= segments; s++) {
                const t = s / segments;
                const angle = baseAngle + t * Math.PI * 0.8;
                const dist = t * r * 0.55;
                gfx.lineTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
            }
        }
        gfx.stroke();

        // 中心星星 - 金色
        gfx.fillColor = new Color(255, 220, 50, 240);
        const sr = r * 0.3;
        const starPoints = 5;
        for (let i = 0; i < starPoints; i++) {
            const outerAngle = -Math.PI / 2 + i * Math.PI * 2 / starPoints + this._animTimer;
            const innerAngle = outerAngle + Math.PI / starPoints;
            const outerR = sr;
            const innerR = sr * 0.4;

            if (i === 0) {
                gfx.moveTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
            } else {
                gfx.lineTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
            }
            gfx.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
        }
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
        this._pulseScale = 1 + 0.12 * Math.sin(this._animTimer * 3);
        this.node.setScale(this._pulseScale, this._pulseScale, 1);

        // 重绘以更新动画效果
        const gfxNode = this.node.getChildByName('PortalGfx');
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
        this.node.setScale(2.2, 2.2, 1);

        // 闪光效果
        const gfxNode = this.node.getChildByName('PortalGfx');
        if (gfxNode) {
            const gfx = gfxNode.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = new Color(255, 200, 50, 220);
                gfx.circle(0, 0, 35);
                gfx.fill();
            }
        }

        this.scheduleOnce(() => {
            this.node.destroy();
        }, 0.15);
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
