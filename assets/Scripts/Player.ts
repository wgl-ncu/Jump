import { _decorator, Component, input, Input, EventTouch, Sprite, Color, Graphics, Animation } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 磁极枚举
 */
export enum MagneticPole {
    N = 1,  // 北极 - 向右
    S = -1  // 南极 - 向左
}

/**
 * 玩家控制 - 纵向卷轴版
 * - 点击屏幕切换磁极
 * - 磁力控制左右移动（左右分别为N/S极，同性相斥异性相吸）
 * - 受磁场反转影响（移动方向翻转）
 */
@ccclass('Player')
export class Player extends Component {

    /** 当前磁极 */
    private _currentPole: MagneticPole = MagneticPole.N;
    public get currentPole(): MagneticPole {
        return this._currentPole;
    }

    /** 磁力加速度（像素/秒²） */
    @property({ tooltip: '磁力加速度' })
    public magneticForce: number = 800;

    /** 最大速度 */
    @property({ tooltip: '最大速度' })
    public maxSpeed: number = 500;

    /** 当前X轴速度 */
    private _velocityX: number = 0;

    /** 场景左边界X */
    private _leftBound: number = -310;
    /** 场景右边界X */
    private _rightBound: number = 310;

    /** 玩家半径（用于碰撞检测） */
    private _radius: number = 22;

    /** 拾取半径（用于金币/道具拾取，比碰撞半径大） */
    private _collectRadius: number = 60;

    /** 切换磁极回调 */
    public onPoleChanged: ((pole: MagneticPole) => void) | null = null;

    /** 是否存活 */
    private _isAlive: boolean = true;
    public get isAlive(): boolean {
        return this._isAlive;
    }

    /** 最大生命值 */
    public readonly MAX_LIVES: number = 3;

    /** 当前生命值 */
    private _lives: number = 3;
    public get lives(): number {
        return this._lives;
    }

    /** 无敌状态 */
    private _isInvincible: boolean = false;
    public get isInvincible(): boolean {
        return this._isInvincible;
    }

    /** 受伤无敌持续时间（秒） */
    private readonly INVINCIBLE_DURATION: number = 1.5;

    /** 道具无敌持续时间（秒） */
    public readonly POWERUP_INVINCIBLE_DURATION: number = 10;

    /** 无敌计时器 */
    private _invincibleTimer: number = 0;

    /** 是否为道具无敌（区别于受伤无敌） */
    private _isPowerupInvincible: boolean = false;
    public get isPowerupInvincible(): boolean {
        return this._isPowerupInvincible;
    }

    /** 道具无敌回调 */
    public onPowerupInvincible: ((active: boolean) => void) | null = null;

    /** 受伤回调 */
    public onHurt: (() => void) | null = null;

    /** 击飞冲刺回调 */
    public onKnockbackDash: (() => void) | null = null;

    /** 冲刺速度倍率 */
    private _dashMultiplier: number = 1;

    /** 击飞冲刺剩余时间 */
    private _dashTimer: number = 0;

    /** 击飞冲刺持续时间 */
    private readonly DASH_DURATION: number = 0.5;

    /** 击飞冲刺速度倍率 */
    private readonly DASH_SPEED_MULT: number = 2.0;

    /** ========= 道具冲刺状态 ========= */

    /** 是否处于道具冲刺状态 */
    private _isPowerupDash: boolean = false;
    public get isPowerupDash(): boolean {
        return this._isPowerupDash;
    }

    /** 道具冲刺持续时间（秒） */
    public readonly POWERUP_DASH_DURATION: number = 5;

    /** 道具冲刺剩余时间 */
    private _powerupDashTimer: number = 0;
    public get powerupDashTimer(): number {
        return this._powerupDashTimer;
    }

    /** 道具冲刺自动拾取垂直范围（一个身位 = 直径） */
    public readonly POWERUP_DASH_COLLECT_VERTICAL_RANGE: number = 44;

    /** 道具冲刺回调 */
    public onPowerupDash: ((active: boolean) => void) | null = null;

    /** 视觉组件引用 */
    private _gfx: Graphics | null = null;
    private _sprite: Sprite | null = null;

    /** ========= 奖励房间状态 ========= */

    /** 是否处于奖励房间 */
    private _isInBonusRoom: boolean = false;
    public get isInBonusRoom(): boolean { return this._isInBonusRoom; }

    /** 奖励房间拾取半径（更大，方便吃金币） */
    private readonly BONUS_ROOM_COLLECT_RADIUS: number = 120;

    /** 正常拾取半径（保存以便恢复） */
    private _normalCollectRadius: number = 60;

    /** N极动画片段名称 */
    @property({ tooltip: 'N极动画片段名称' })
    public animClipNameN: string = 'DefaultPlayerIdleN';

    /** S极动画片段名称 */
    @property({ tooltip: 'S极动画片段名称' })
    public animClipNameS: string = 'DefaultPlayerIdleS';

    /** 动画组件（来自预制体子节点） */
    private _anim: Animation | null = null;

    /** 是否有角色精灵（有预制体动画时跳过Graphics主体绘制） */
    private _hasCharacterSprite: boolean = false;

    /** ========= 磁极切换缩放动画 ========= */

    /** 切换动画总时长（秒） */
    private readonly SWITCH_ANIM_DURATION: number = 0.2;

    /** 切换动画计时器（<0表示未在播放） */
    private _switchAnimTimer: number = -1;

    /** 切换动画：是否已完成缩小阶段（缩小到0后切换磁极） */
    private _switchAnimFlipped: boolean = false;

    /** 切换动画：待切换的目标磁极 */
    private _switchAnimTargetPole: MagneticPole = MagneticPole.N;

    /** 磁场反转系数（0=正常, 1=完全反转） */
    private _reversalFactor: number = 0;

    start() {
        input.on(Input.EventType.TOUCH_START, this.onTouch, this);
        // Sprite可能在自身节点或子节点上（预制体在子节点"Img"上）
        this._sprite = this.node.getComponent(Sprite) || this.node.getComponentInChildren(Sprite);
        this._gfx = this.node.getComponentInChildren(Graphics);
        this._anim = this.node.getComponentInChildren(Animation);

        if (this._anim) {
            this._hasCharacterSprite = true;
            this.playIdleAnimation();
        }

        this.updateVisual();
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouch, this);
    }

    public setBounds(left: number, right: number) {
        this._leftBound = left;
        this._rightBound = right;
    }

    public setRadius(r: number) {
        this._radius = r;
    }

    public getRadius(): number {
        return this._radius;
    }

    public setCollectRadius(r: number) {
        this._collectRadius = r;
    }

    public getCollectRadius(): number {
        return this._collectRadius;
    }

    /**
     * 设置磁场反转系数
     */
    public setReversalFactor(factor: number) {
        this._reversalFactor = factor;
    }

    /**
     * 触发击飞冲刺（击飞障碍物后短暂加速）
     */
    public startDash() {
        this._dashMultiplier = this.DASH_SPEED_MULT;
        this._dashTimer = this.DASH_DURATION;
        this.onKnockbackDash?.();
    }

    /**
     * 播放当前磁极对应的待机动画
     */
    public playIdleAnimation() {
        if (!this._anim) return;
        const clipName = this._currentPole === MagneticPole.N ? this.animClipNameN : this.animClipNameS;
        // 尝试播放对应磁极动画，找不到则回退到第一个片段
        const clip = this._anim.clips.find(c => c.name === clipName);
        if (clip) {
            this._anim.play(clipName);
        } else {
            const clips = this._anim.clips;
            if (clips.length > 0) {
                this._anim.play(clips[0].name);
            } else if (this._anim.defaultClip) {
                this._anim.play();
            }
        }
    }

    /**
     * 点击屏幕切换磁极
     */
    private onTouch(_event: EventTouch) {
        if (!this._isAlive) return;
        this.switchPole();
    }

    public switchPole() {
        const targetPole = this._currentPole === MagneticPole.N ? MagneticPole.S : MagneticPole.N;

        // 如果有角色精灵，播放缩放切换动画
        if (this._hasCharacterSprite) {
            if (this._switchAnimTimer >= 0) {
                // 正在切换中，立即完成上一次
                this.finishSwitchAnim();
            }
            this._switchAnimTimer = this.SWITCH_ANIM_DURATION;
            this._switchAnimFlipped = false;
            this._switchAnimTargetPole = targetPole;
            return;
        }

        // 无角色精灵时直接切换
        this._currentPole = targetPole;
        this.updateVisual();
        this.onPoleChanged?.(this._currentPole);
    }

    /**
     * 完成切换动画（立即跳到最终状态）
     */
    private finishSwitchAnim() {
        if (this._switchAnimTimer < 0) return;
        this._switchAnimTimer = -1;
        this._switchAnimFlipped = false;
        this._currentPole = this._switchAnimTargetPole;
        this.node.setScale(1, 1, 1);
        this.updateVisual();
        this.onPoleChanged?.(this._currentPole);
    }

    /**
     * 更新切换缩放动画
     */
    private updateSwitchAnim(dt: number) {
        if (this._switchAnimTimer < 0) return;

        this._switchAnimTimer -= dt;
        const halfDuration = this.SWITCH_ANIM_DURATION / 2;

        if (this._switchAnimTimer <= halfDuration && !this._switchAnimFlipped) {
            // 缩小到0 → 切换磁极
            this._switchAnimFlipped = true;
            this._currentPole = this._switchAnimTargetPole;
            this.updateVisual();
            this.onPoleChanged?.(this._currentPole);
        }

        if (this._switchAnimTimer <= 0) {
            // 动画结束
            this._switchAnimTimer = -1;
            this._switchAnimFlipped = false;
            this.node.setScale(1, 1, 1);
            return;
        }

        // 计算缩放值
        let scale: number;
        if (this._switchAnimTimer > halfDuration) {
            // 前半段：1 → 0（缩小）
            const t = (this._switchAnimTimer - halfDuration) / halfDuration; // 1→0
            scale = t;
        } else {
            // 后半段：0 → 1（放大）
            const t = this._switchAnimTimer / halfDuration; // 1→0 (remaining)
            scale = 1 - t;
        }

        this.node.setScale(scale, scale, 1);
    }

    private updateVisual() {
        if (this._hasCharacterSprite && this._anim) {
            // 有角色精灵动画时，播放对应磁极动画替代变色
            const clipName = this._currentPole === MagneticPole.N ? this.animClipNameN : this.animClipNameS;
            // 检查目标动画是否已在播放
            const targetClip = this._anim.clips.find(c => c.name === clipName);
            if (targetClip) {
                const state = this._anim.getState(clipName);
                if (!state || !state.isPlaying) {
                    this._anim.play(clipName);
                }
            } else {
                // 找不到指定动画，回退到默认
                this.playIdleAnimation();
            }
        } else if (this._sprite) {
            // 无动画时，通过变色区分磁极
            this._sprite.color = this._currentPole === MagneticPole.N
                ? new Color(255, 80, 80, 255)
                : new Color(80, 80, 255, 255);
        }
        // 重绘Graphics效果
        this.drawPlayerGfx();
    }

    private drawPlayerGfx() {
        if (!this._gfx) return;
        const gfx = this._gfx;
        gfx.clear();

        const r = this._radius;
        const isN = this._currentPole === MagneticPole.N;
        const mainColor = isN ? new Color(255, 80, 80, 255) : new Color(80, 80, 255, 255);
        const innerColor = isN ? new Color(255, 200, 200, 255) : new Color(200, 200, 255, 255);

        // 外圈发光 - 反转时显示紫色光环
        if (this._reversalFactor > 0.1) {
            gfx.fillColor = new Color(160, 60, 220, Math.floor(30 * this._reversalFactor));
            gfx.circle(0, 0, r + 14);
            gfx.fill();
        }

        // 外圈发光
        gfx.fillColor = isN ? new Color(255, 80, 80, 40) : new Color(80, 80, 255, 40);
        gfx.circle(0, 0, r + 8);
        gfx.fill();

        if (!this._hasCharacterSprite) {
            // 无角色精灵时：用Graphics绘制主体
            // 主体圆
            gfx.fillColor = mainColor;
            gfx.circle(0, 0, r);
            gfx.fill();

            // 内圈
            gfx.fillColor = innerColor;
            gfx.circle(0, 0, r * 0.6);
            gfx.fill();

            // 磁极符号 - 左右箭头
            gfx.fillColor = new Color(255, 255, 255, 230);
            if (isN) {
                // N 极 - 画向右的三角箭头
                gfx.moveTo(r * 0.35, 0);
                gfx.lineTo(-r * 0.15, r * 0.25);
                gfx.lineTo(-r * 0.15, -r * 0.25);
                gfx.close();
                gfx.fill();
            } else {
                // S 极 - 画向左的三角箭头
                gfx.moveTo(-r * 0.35, 0);
                gfx.lineTo(r * 0.15, r * 0.25);
                gfx.lineTo(r * 0.15, -r * 0.25);
                gfx.close();
                gfx.fill();
            }
        }

        // 无敌保护壳
        if (this._isInvincible) {
            const shieldR = r + 12;
            if (this._isPowerupInvincible) {
                // 道具无敌 - 青蓝色大护盾
                // 外层强发光
                gfx.fillColor = new Color(60, 200, 255, 60);
                gfx.circle(0, 0, shieldR + 10);
                gfx.fill();
                // 保护壳圆环
                gfx.strokeColor = new Color(80, 220, 255, 220);
                gfx.lineWidth = 4;
                gfx.circle(0, 0, shieldR + 2);
                gfx.stroke();
                // 内层圆环
                gfx.strokeColor = new Color(150, 240, 255, 150);
                gfx.lineWidth = 2;
                gfx.circle(0, 0, shieldR - 3);
                gfx.stroke();
                // 旋转六边形
                gfx.strokeColor = new Color(100, 230, 255, 180);
                gfx.lineWidth = 2;
                const angle = this._invincibleTimer * 2;
                for (let i = 0; i < 6; i++) {
                    const a = angle + i * Math.PI / 3;
                    const px = Math.cos(a) * (shieldR + 2);
                    const py = Math.sin(a) * (shieldR + 2);
                    gfx.moveTo(0, 0);
                    gfx.lineTo(px, py);
                }
                gfx.stroke();
                // 外圈旋转菱形装饰
                gfx.strokeColor = new Color(150, 240, 255, 120);
                gfx.lineWidth = 1.5;
                const outerAngle = -this._invincibleTimer * 1.5;
                for (let i = 0; i < 8; i++) {
                    const a = outerAngle + i * Math.PI / 4;
                    const d = shieldR + 6;
                    const px = Math.cos(a) * d;
                    const py = Math.sin(a) * d;
                    const s = 4;
                    gfx.moveTo(px, py + s);
                    gfx.lineTo(px + s, py);
                    gfx.lineTo(px, py - s);
                    gfx.lineTo(px - s, py);
                    gfx.close();
                    gfx.stroke();
                }
            } else {
                // 受伤无敌 - 原有金色半透明圆环 + 旋转六边形
                // 外层发光
                gfx.fillColor = new Color(255, 220, 80, 40);
                gfx.circle(0, 0, shieldR + 6);
                gfx.fill();
                // 保护壳圆环
                gfx.strokeColor = new Color(255, 200, 50, 200);
                gfx.lineWidth = 3;
                gfx.circle(0, 0, shieldR);
                gfx.stroke();
                // 内层圆环
                gfx.strokeColor = new Color(255, 255, 150, 120);
                gfx.lineWidth = 1.5;
                gfx.circle(0, 0, shieldR - 4);
                gfx.stroke();
                // 六边形装饰
                gfx.strokeColor = new Color(255, 220, 80, 160);
                gfx.lineWidth = 2;
                const angle = this._invincibleTimer * 3;
                for (let i = 0; i < 6; i++) {
                    const a = angle + i * Math.PI / 3;
                    const px = Math.cos(a) * shieldR;
                    const py = Math.sin(a) * shieldR;
                    gfx.moveTo(0, 0);
                    gfx.lineTo(px, py);
                }
                gfx.stroke();
            }
        }

        // 冲刺效果
        if (this._isPowerupDash) {
            // 道具冲刺 - 橙色火焰光环
            const dashR = r + 16;
            // 外层火焰
            gfx.fillColor = new Color(255, 150, 30, 70);
            gfx.circle(0, 0, dashR + 8);
            gfx.fill();
            // 中层
            gfx.fillColor = new Color(255, 180, 50, 50);
            gfx.circle(0, 0, dashR + 3);
            gfx.fill();
            // 火焰圆环
            gfx.strokeColor = new Color(255, 160, 30, 220);
            gfx.lineWidth = 4;
            gfx.circle(0, 0, dashR);
            gfx.stroke();
            // 内层高光
            gfx.strokeColor = new Color(255, 220, 100, 160);
            gfx.lineWidth = 2;
            gfx.circle(0, 0, dashR - 5);
            gfx.stroke();
            // 旋转火焰尾迹
            gfx.strokeColor = new Color(255, 180, 50, 150);
            gfx.lineWidth = 2;
            const trailAngle = this._powerupDashTimer * 4;
            for (let i = 0; i < 4; i++) {
                const a = trailAngle + i * Math.PI / 2;
                const px = Math.cos(a) * (dashR + 2);
                const py = Math.sin(a) * (dashR + 2);
                const tx = Math.cos(a + 0.3) * (dashR + 10);
                const ty = Math.sin(a + 0.3) * (dashR + 10);
                gfx.moveTo(px, py);
                gfx.lineTo(tx, ty);
            }
            gfx.stroke();
            // 自动拾取垂直范围指示（全宽横带）
            const collectV = this.POWERUP_DASH_COLLECT_VERTICAL_RANGE;
            gfx.strokeColor = new Color(255, 200, 80, 30);
            gfx.lineWidth = 1;
            // 全宽横条
            const halfW = 300;
            gfx.rect(-halfW, -collectV, halfW * 2, collectV * 2);
            gfx.stroke();
        } else if (this._dashTimer > 0) {
            // 击飞冲刺 - 金色拖尾光环
            const progress = this._dashTimer / this.DASH_DURATION;
            const trailAlpha = Math.floor(100 * progress);
            gfx.fillColor = new Color(255, 220, 80, trailAlpha);
            gfx.circle(0, 0, r + 18);
            gfx.fill();
            gfx.strokeColor = new Color(255, 200, 50, Math.floor(180 * progress));
            gfx.lineWidth = 2;
            gfx.circle(0, 0, r + 18);
            gfx.stroke();
        }

        // 奖励房间特效 - 金色光环
        if (this._isInBonusRoom) {
            const bonusR = r + 20;
            // 外层金色发光
            gfx.fillColor = new Color(255, 200, 50, 35);
            gfx.circle(0, 0, bonusR + 12);
            gfx.fill();
            // 中层
            gfx.fillColor = new Color(255, 220, 80, 25);
            gfx.circle(0, 0, bonusR + 6);
            gfx.fill();
            // 金色圆环
            gfx.strokeColor = new Color(255, 200, 50, 200);
            gfx.lineWidth = 3;
            gfx.circle(0, 0, bonusR);
            gfx.stroke();
            // 内层高光
            gfx.strokeColor = new Color(255, 240, 150, 140);
            gfx.lineWidth = 1.5;
            gfx.circle(0, 0, bonusR - 5);
            gfx.stroke();
            // 旋转星星装饰
            gfx.fillColor = new Color(255, 220, 50, 180);
            const starAngle = this._invincibleTimer * 1.5;
            for (let i = 0; i < 6; i++) {
                const a = starAngle + i * Math.PI / 3;
                const d = bonusR + 2;
                const sx = Math.cos(a) * d;
                const sy = Math.sin(a) * d;
                const size = 3;
                gfx.moveTo(sx, sy + size);
                gfx.lineTo(sx + size * 0.3, sy + size * 0.3);
                gfx.lineTo(sx + size, sy);
                gfx.lineTo(sx + size * 0.3, sy - size * 0.3);
                gfx.lineTo(sx, sy - size);
                gfx.lineTo(sx - size * 0.3, sy - size * 0.3);
                gfx.lineTo(sx - size, sy);
                gfx.lineTo(sx - size * 0.3, sy + size * 0.3);
                gfx.close();
                gfx.fill();
            }
            // 扩大的拾取范围指示
            const collectR = this._collectRadius;
            gfx.strokeColor = new Color(255, 200, 50, 20);
            gfx.lineWidth = 1;
            gfx.circle(0, 0, collectR);
            gfx.stroke();
        }
    }

    update(dt: number) {
        if (!this._isAlive) return;

        // 磁极切换缩放动画
        this.updateSwitchAnim(dt);

        // 无敌计时 + 保护壳视觉
        if (this._isInvincible) {
            this._invincibleTimer -= dt;
            if (this._invincibleTimer <= 0) {
                this._isInvincible = false;
                this._invincibleTimer = 0;
                if (this._isPowerupInvincible) {
                    this._isPowerupInvincible = false;
                    this.onPowerupInvincible?.(false);
                }
            }
            this.drawPlayerGfx();
        }

        // 击飞冲刺计时
        if (this._dashTimer > 0) {
            this._dashTimer -= dt;
            if (this._dashTimer <= 0) {
                this._dashTimer = 0;
                // 只在非道具冲刺时重置倍率
                if (!this._isPowerupDash) {
                    this._dashMultiplier = 1;
                }
                this.drawPlayerGfx();
            } else {
                this.drawPlayerGfx();
            }
        }

        // 道具冲刺计时
        if (this._isPowerupDash) {
            this._powerupDashTimer -= dt;
            if (this._powerupDashTimer <= 0) {
                this._isPowerupDash = false;
                this._powerupDashTimer = 0;
                this._dashMultiplier = this._dashTimer > 0 ? this.DASH_SPEED_MULT : 1;
                this.onPowerupDash?.(false);
                this.drawPlayerGfx();
            } else {
                this.drawPlayerGfx();
            }
        }

        // 道具冲刺时无视磁力，保持直线前进
        if (this._isPowerupDash) {
            // 快速衰减横向速度，保持直线
            this._velocityX *= 0.9;
            if (Math.abs(this._velocityX) < 1) this._velocityX = 0;
        } else {
            // 磁力逻辑（横向）：
            // 场景左方为N极，右方为S极
            // 玩家N极 -> 被左侧同性排斥 -> 向右 + 被右侧异性吸引 -> 向右 → 总向右
            // 玩家S极 -> 被右侧同性排斥 -> 向左 + 被左侧异性吸引 -> 向左 → 总向左
            // 反转时：力方向取反
            const reversalMultiplier = 1 - 2 * this._reversalFactor; // 0->1, 1->-1
            const forceDirection = this._currentPole * reversalMultiplier;
            this._velocityX += forceDirection * this.magneticForce * this._dashMultiplier * dt;

            // 添加轻微阻力
            this._velocityX *= 0.98;

            // 限制速度（冲刺时上限也提高）
            const speedLimit = this.maxSpeed * this._dashMultiplier;
            this._velocityX = Math.max(-speedLimit, Math.min(speedLimit, this._velocityX));
        }

        // 更新位置
        const playerPos = this.node.position;
        let newX = playerPos.x + this._velocityX * dt;

        // 边界碰撞
        if (newX > this._rightBound - this._radius) {
            newX = this._rightBound - this._radius;
            this._velocityX = 0;
        } else if (newX < this._leftBound + this._radius) {
            newX = this._leftBound + this._radius;
            this._velocityX = 0;
        }

        this.node.setPosition(newX, playerPos.y, playerPos.z);
    }

    public die() {
        this._isAlive = false;
        this._velocityX = 0;
        this._anim?.stop();
        this._switchAnimTimer = -1;
        this._switchAnimFlipped = false;
        this.node.setScale(1, 1, 1);
    }

    /**
     * 激活道具无敌（10秒）
     */
    public activatePowerupInvincible(duration: number = 10) {
        this._isInvincible = true;
        this._isPowerupInvincible = true;
        this._invincibleTimer = duration;
        this.onPowerupInvincible?.(true);
        this.drawPlayerGfx();
    }

    /**
     * 激活道具冲刺（5秒）
     */
    public activatePowerupDash(duration: number = 5) {
        this._isPowerupDash = true;
        this._powerupDashTimer = duration;
        // 冲刺时无视磁力，不设置 _dashMultiplier（由 ObstacleSpawner 处理滚动加速）
        this.onPowerupDash?.(true);
        this.drawPlayerGfx();
    }

    /**
     * 进入奖励房间
     */
    public activateBonusRoom() {
        this._isInBonusRoom = true;
        // 保存当前拾取半径并扩大
        this._normalCollectRadius = this._collectRadius;
        this._collectRadius = this.BONUS_ROOM_COLLECT_RADIUS;
        // 奖励房间内无敌
        this.activatePowerupInvincible(15); // 足够长的无敌时间，退出时会重新设置
        this.drawPlayerGfx();
    }

    /**
     * 退出奖励房间
     */
    public deactivateBonusRoom() {
        this._isInBonusRoom = false;
        // 恢复拾取半径
        this._collectRadius = this._normalCollectRadius;
        this.drawPlayerGfx();
    }

    /**
     * 受到伤害，扣1生命值
     * @returns true 如果还有生命，false 如果死亡
     */
    public takeDamage(): boolean {
        if (this._isInvincible || !this._isAlive) return false;

        this._lives--;
        if (this._lives <= 0) {
            this.die();
            return false;
        }

        // 进入受伤无敌状态
        this._isInvincible = true;
        this._isPowerupInvincible = false;
        this._invincibleTimer = this.INVINCIBLE_DURATION;
        this.onHurt?.();
        return true;
    }

    public reset() {
        this._isAlive = true;
        this._lives = this.MAX_LIVES;
        this._isInvincible = false;
        this._invincibleTimer = 0;
        this._isPowerupInvincible = false;
        this._isPowerupDash = false;
        this._powerupDashTimer = 0;
        this._isInBonusRoom = false;
        this._collectRadius = 80; // 恢复默认
        this._currentPole = MagneticPole.N;
        this._velocityX = 0;
        this._reversalFactor = 0;
        this._dashMultiplier = 1;
        this._dashTimer = 0;
        this._switchAnimTimer = -1;
        this._switchAnimFlipped = false;
        this.node.setScale(1, 1, 1);
        this.node.setPosition(0, this.node.position.y, 0);
        this.updateVisual();
        this.playIdleAnimation();
    }

    /**
     * 获取碰撞用半径
     */
    public getCollisionRadius(): number {
        return this._radius;
    }
}
