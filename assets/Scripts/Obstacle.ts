import { _decorator, Component, Graphics, Color, Node, UITransform, Size, Sprite } from 'cc';
import { MagneticPole } from './Player';
const { ccclass } = _decorator;

/**
 * 障碍物磁荷枚举
 */
export enum ObstacleCharge {
    None = 0,   // 无磁荷 - 普通障碍物
    N = 1,      // N极磁荷 - 红色系
    S = -1      // S极磁荷 - 蓝色系
}

/**
 * 障碍物 - 从下向上移动
 * 支持磁荷系统：玩家用相斥磁极靠近时，障碍物被打飞
 */
@ccclass('Obstacle')
export class Obstacle extends Component {

    /** 移动速度（像素/秒） */
    private _speed: number = 300;
    public set speed(v: number) { this._speed = v; }
    public get speed(): number { return this._speed; }

    /** 是否已经过玩家（用于计分） */
    private _passed: boolean = false;
    public get passed(): boolean { return this._passed; }
    public set passed(v: boolean) { this._passed = v; }

    /** 是否已经离开屏幕 */
    private _outOfScreen: boolean = false;
    public get outOfScreen(): boolean { return this._outOfScreen; }

    /** 碰撞矩形参数（半宽半高） */
    private _halfW: number = 30;
    private _halfH: number = 100;

    /** 玩家检测线Y位置 */
    private _playerLineY: number = 200;

    /** 磁荷类型 */
    private _charge: ObstacleCharge = ObstacleCharge.None;
    public get charge(): ObstacleCharge { return this._charge; }
    public set charge(v: ObstacleCharge) {
        this._charge = v;
        this.updateChargeVisual();
    }

    /** 磁力触发距离（玩家相斥磁极在此距离内触发弹飞） */
    private _fieldRadius: number = 80;
    public get fieldRadius(): number { return this._fieldRadius; }
    public set fieldRadius(v: number) { this._fieldRadius = v; }

    /** 弹飞速度（像素/秒） */
    private _knockbackSpeed: number = 2000;
    public get knockbackSpeed(): number { return this._knockbackSpeed; }
    public set knockbackSpeed(v: number) { this._knockbackSpeed = v; }

    /** 是否已被弹飞 */
    private _isKnockedBack: boolean = false;
    public get isKnockedBack(): boolean { return this._isKnockedBack; }

    /** 弹飞后的水平速度 */
    private _knockVelocityX: number = 0;

    /** 弹飞后的垂直速度（向上） */
    private _knockVelocityY: number = 0;

    /** 弹飞旋转角度速度（度/秒） */
    private _knockAngularSpeed: number = 0;

    /** 影响范围可视化节点 */
    private _fieldGfxNode: Node | null = null;

    public setHalfSize(halfW: number, halfH: number) {
        this._halfW = halfW;
        this._halfH = halfH;
    }

    public setPlayerLineY(y: number) {
        this._playerLineY = y;
    }

    start() {
        this.updateChargeVisual();
    }

    update(dt: number) {
        const pos = this.node.position;

        if (this._isKnockedBack) {
            // 弹飞状态：快速飞出，不衰减
            let newX = pos.x + this._knockVelocityX * dt;
            let newY = pos.y + this._knockVelocityY * dt;

            this.node.setPosition(newX, newY, pos.z);

            // 旋转效果
            this.node.angle += this._knockAngularSpeed * dt;

            // 飞出屏幕范围后标记出屏并销毁
            if (Math.abs(newX) > 600 || newY > 900 || newY < -900) {
                this._outOfScreen = true;
                this.node.destroy();
            }
        } else {
            // 正常向上移动
            this.node.setPosition(pos.x, pos.y + this._speed * dt, pos.z);

            // 判断是否通过玩家检测线
            if (!this._passed && this.node.position.y > this._playerLineY) {
                this._passed = true;
            }

            // 判断是否离开屏幕顶部
            if (this.node.position.y > 800) {
                this._outOfScreen = true;
            }
        }
    }

    /**
     * 检测玩家是否用相斥磁极靠近到触发距离
     * 如果是，执行弹飞
     * @param playerX 玩家X坐标
     * @param playerY 玩家Y坐标
     * @param playerPole 玩家磁极
     * @returns 是否触发了弹飞
     */
    public checkRepelAndKnockback(playerX: number, playerY: number, playerPole: MagneticPole): boolean {
        if (this._charge === ObstacleCharge.None || this._isKnockedBack) return false;

        // 只有同性相斥才能弹飞
        const isSamePole = (this._charge as number === playerPole as number);
        if (!isSamePole) return false;

        const pos = this.node.position;
        // 计算玩家到障碍物最近边缘的距离
        const nearestX = Math.max(pos.x - this._halfW, Math.min(playerX, pos.x + this._halfW));
        const nearestY = Math.max(pos.y - this._halfH, Math.min(playerY, pos.y + this._halfH));
        const dx = playerX - nearestX;
        const dy = playerY - nearestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 超出触发距离
        if (dist > this._fieldRadius) return false;

        // 执行弹飞！用玩家到障碍物中心的方向来决定弹飞方向
        const centerDx = playerX - pos.x;
        const centerDy = playerY - pos.y;
        const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
        this.knockback(centerDx, centerDy, Math.max(centerDist, 10));
        return true;
    }

    /**
     * 弹飞障碍物
     * @param fromDx 从障碍物指向玩家的X方向
     * @param fromDy 从障碍物指向玩家的Y方向
     * @param dist 距离
     */
    private knockback(fromDx: number, fromDy: number, dist: number) {
        this._isKnockedBack = true;

        // 弹飞方向：从玩家指向障碍物（排斥方向）
        // fromDx 是 玩家-障碍物，所以障碍物飞出方向是 -fromDx
        const safeDist = Math.max(dist, 10);
        const nx = -fromDx / safeDist;
        const ny = -fromDy / safeDist;

        // 弹飞速度 = 基础速度 × 方向
        // X方向给予更大速度（水平飞出更明显）
        this._knockVelocityX = nx * this._knockbackSpeed * 1.5;
        this._knockVelocityY = ny * this._knockbackSpeed * 0.8 + this._speed; // 保留向上速度

        // 随机旋转
        this._knockAngularSpeed = (Math.random() - 0.5) * 720;

        // 标记为已通过（不会阻碍计分）
        this._passed = true;

        // 视觉反馈：变透明
        const sprite = this.node.getComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(sprite.color.r, sprite.color.g, sprite.color.b, 150);
        }
    }

    /**
     * 强制弹飞（由冲刺道具碰撞触发，不依赖磁荷）
     * @param fromDx 从障碍物指向玩家的X方向
     * @param fromDy 从障碍物指向玩家的Y方向
     * @param dist 距离
     */
    public forceKnockback(fromDx: number, fromDy: number, dist: number) {
        if (this._isKnockedBack) return;
        this.knockback(fromDx, fromDy, dist);
    }

    /**
     * 从指定位置向外弹飞（冲刺结束时全屏弹飞用）
     * @param fromX 弹飞源点X（通常是玩家位置）
     * @param fromY 弹飞源点Y
     * @param speed 弹飞速度
     */
    public forceKnockbackFrom(fromX: number, fromY: number, speed: number = 1500) {
        if (this._isKnockedBack) return;

        this._isKnockedBack = true;

        const pos = this.node.position;
        const dx = pos.x - fromX;
        const dy = pos.y - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const safeDist = Math.max(dist, 10);

        // 从源点向外飞出，X方向给予更大速度
        this._knockVelocityX = (dx / safeDist) * speed * 1.5;
        this._knockVelocityY = (dy / safeDist) * speed * 0.8 + this._speed;

        // 随机旋转
        this._knockAngularSpeed = (Math.random() - 0.5) * 720;

        // 标记为已通过（不会阻碍计分）
        this._passed = true;

        // 视觉反馈：变透明
        const sprite = this.node.getComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(sprite.color.r, sprite.color.g, sprite.color.b, 150);
        }
    }

    /**
     * 获取碰撞矩形（世界坐标，中心 + 半宽半高）
     */
    public getCollisionRect(): { cx: number; cy: number; halfW: number; halfH: number } {
        const pos = this.node.position;
        return {
            cx: pos.x,
            cy: pos.y,
            halfW: this._halfW,
            halfH: this._halfH
        };
    }

    /**
     * 更新磁荷视觉
     */
    private updateChargeVisual() {
        if (this._charge === ObstacleCharge.None) return;

        // 确保影响范围可视化节点存在
        if (!this._fieldGfxNode || !this._fieldGfxNode.isValid) {
            this._fieldGfxNode = new Node('FieldRange');
            this._fieldGfxNode.setParent(this.node);
            this._fieldGfxNode.addComponent(UITransform).setContentSize(
                new Size(this._fieldRadius * 2, this._fieldRadius * 2)
            );
        }

        const gfx = this._fieldGfxNode.getComponent(Graphics) || this._fieldGfxNode.addComponent(Graphics);
        gfx.clear();

        const r = this._fieldRadius;
        const isN = this._charge === ObstacleCharge.N;

        // 触发范围圆圈 - 更醒目的虚线效果
        gfx.strokeColor = isN
            ? new Color(255, 100, 100, 80)
            : new Color(100, 100, 255, 80);
        gfx.lineWidth = 2;
        gfx.circle(0, 0, r);
        gfx.stroke();

        // 内圈
        gfx.strokeColor = isN
            ? new Color(255, 80, 80, 35)
            : new Color(80, 80, 255, 35);
        gfx.lineWidth = 1;
        gfx.circle(0, 0, r * 0.6);
        gfx.stroke();

        // 排斥标记 - 向外的三角箭头（两侧各一个）
        const arrowY = this._halfH + 14;
        gfx.fillColor = isN
            ? new Color(255, 100, 100, 200)
            : new Color(100, 100, 255, 200);

        // 左箭头
        gfx.moveTo(-10, arrowY);
        gfx.lineTo(-18, arrowY + 6);
        gfx.lineTo(-18, arrowY - 6);
        gfx.close();
        gfx.fill();

        // 右箭头
        gfx.moveTo(10, arrowY);
        gfx.lineTo(18, arrowY + 6);
        gfx.lineTo(18, arrowY - 6);
        gfx.close();
        gfx.fill();

        // 中心磁极符号
        if (isN) {
            gfx.fillColor = new Color(255, 100, 100, 220);
            gfx.moveTo(0, arrowY + 8);
            gfx.lineTo(-5, arrowY);
            gfx.lineTo(5, arrowY);
            gfx.close();
            gfx.fill();
        } else {
            gfx.fillColor = new Color(100, 100, 255, 220);
            gfx.moveTo(0, arrowY);
            gfx.lineTo(-5, arrowY + 8);
            gfx.lineTo(5, arrowY + 8);
            gfx.close();
            gfx.fill();
        }
    }

    public reset() {
        this._passed = false;
        this._outOfScreen = false;
        this._isKnockedBack = false;
        this._knockVelocityX = 0;
        this._knockVelocityY = 0;
        this._knockAngularSpeed = 0;
    }
}
