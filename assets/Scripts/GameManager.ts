import { _decorator, Component, director } from 'cc';
import { Player, MagneticPole } from './Player';
import { Obstacle, ObstacleCharge } from './Obstacle';
import { Coin } from './Coin';
import { InvincibleItem } from './InvincibleItem';
import { DashItem } from './DashItem';
import { BonusPortalItem } from './BonusPortalItem';
import { ObstacleSpawner } from './ObstacleSpawner';
import { UIManager } from './UIManager';
import { MagneticField } from './MagneticField';
import { SceneBuilder } from './SceneBuilder';
import { MagneticZoneManager } from './MagneticZoneManager';
const { ccclass, property } = _decorator;

/** 游戏状态 */
enum GameState {
    Ready,
    Playing,
    GameOver
}

/**
 * 游戏管理器 - 纵向卷轴版
 * 
 * 核心逻辑：
 * - 障碍物从屏幕下方生成，向上移动
 * - 玩家在屏幕中上方，左右移动躲避
 * - 碰到障碍物或墙壁则失败
 * - 穿过障碍物行加分
 * - 带磁极障碍物产生磁力影响
 * - 磁场反转区域改变移动方向
 */
@ccclass('GameManager')
export class GameManager extends Component {

    @property({ type: Player, tooltip: '玩家组件' })
    public player: Player | null = null;

    @property({ type: ObstacleSpawner, tooltip: '障碍物生成器' })
    public obstacleSpawner: ObstacleSpawner | null = null;

    @property({ type: UIManager, tooltip: 'UI管理器' })
    public uiManager: UIManager | null = null;

    @property({ type: MagneticField, tooltip: '磁场视觉' })
    public magneticField: MagneticField | null = null;

    @property({ type: MagneticZoneManager, tooltip: '磁场区域管理器' })
    public magneticZoneManager: MagneticZoneManager | null = null;

    /** 场景左边界X */
    public leftBound: number = -310;

    /** 场景右边界X */
    public rightBound: number = 310;

    /** 玩家所在Y位置 */
    public readonly PLAYER_Y: number = 200;

    /** 碰撞检测Y范围 */
    private readonly COLLISION_Y_RANGE: number = 30;

    /** 游戏状态 */
    private _state: GameState = GameState.Ready;

    /** 当前分数 */
    private _score: number = 0;

    /** 场景构建器引用 */
    private _sceneBuilder: SceneBuilder | null = null;

    /** 已初始化 */
    private _initialized: boolean = false;

    /** 已计分的groupId */
    private _scoredGroups: Set<number> = new Set();

    /** ========= 奖励房间状态 ========= */

    /** 是否处于奖励房间 */
    private _isInBonusRoom: boolean = false;
    public get isInBonusRoom(): boolean { return this._isInBonusRoom; }

    /** 奖励房间倒计时 */
    private _bonusRoomTimer: number = 0;

    /** 奖励房间持续时间（秒） */
    private readonly BONUS_ROOM_DURATION: number = 10;

    /** 退出奖励房间后的缓冲无敌时间（秒） */
    private readonly BONUS_ROOM_BUFFER_INVINCIBLE: number = 2;

    start() {
        this.tryInitGame();
    }

    /** 等待场景构建完成后再初始化 */
    private tryInitGame() {
        this._sceneBuilder = this.node.getComponent(SceneBuilder);
        if (!this._sceneBuilder) {
            this._sceneBuilder = this.node.getComponentInChildren(SceneBuilder);
        }

        // 场景还没构建完（resources.load 异步），轮询等待
        if (!this._sceneBuilder || !this._sceneBuilder.getPlayer()) {
            this.scheduleOnce(() => this.tryInitGame(), 0.1);
            return;
        }

        this.initGame();
    }

    private initGame() {
        this._sceneBuilder = this.node.getComponent(SceneBuilder);
        if (!this._sceneBuilder) {
            this._sceneBuilder = this.node.getComponentInChildren(SceneBuilder);
        }

        if (this._sceneBuilder) {
            if (!this.player) this.player = this._sceneBuilder.getPlayer();
            if (!this.obstacleSpawner) this.obstacleSpawner = this._sceneBuilder.getObstacleSpawner();
            if (!this.uiManager) this.uiManager = this._sceneBuilder.getUIManager();
            if (!this.magneticField) this.magneticField = this._sceneBuilder.getMagneticField();
            if (!this.magneticZoneManager) this.magneticZoneManager = this._sceneBuilder.getMagneticZoneManager();
        }

        if (this.player) {
            this.player.setBounds(this.leftBound, this.rightBound);
            this.player.onPoleChanged = (pole: MagneticPole) => {
                this.uiManager?.updatePoleIndicator(pole);
            };
        }

        if (this.magneticField) {
            this.magneticField.init(this.rightBound - this.leftBound, 0);
        }

        if (this.magneticZoneManager) {
            this.magneticZoneManager.setPlayerY(this.PLAYER_Y);
            this.magneticZoneManager.setPlayWidth(this.rightBound - this.leftBound);
        }

        if (this.obstacleSpawner) {
            this.obstacleSpawner.playerLineY = this.PLAYER_Y;
        }

        this.bindUIEvents();
        this._state = GameState.Ready;
        this._initialized = true;

        // 进入battle场景直接开始游戏
        this.startGame();
    }

    private bindUIEvents() {
        if (this.uiManager) {
            this.uiManager.onStartClicked = () => this.startGame();
            this.uiManager.onRestartClicked = () => this.restartGame();
            this.uiManager.onBackToMainClicked = () => this.backToMain();
        }
    }

    private backToMain() {
        director.loadScene('main');
    }

    private startGame() {
        this._state = GameState.Playing;
        this._score = 0;
        this._scoredGroups.clear();
        this._isInBonusRoom = false;
        this._bonusRoomTimer = 0;

        if (this.player) {
            this.player.reset();
            this.player.setBounds(this.leftBound, this.rightBound);
            this.player.onHurt = () => {
                this.uiManager?.updateLives(this.player!.lives);
            };
            this.player.onPowerupInvincible = (active: boolean) => {
                if (active) {
                    this.uiManager?.updateInvincibleStatus(true, this.player!.POWERUP_INVINCIBLE_DURATION);
                } else {
                    this.uiManager?.updateInvincibleStatus(false);
                }
                this.obstacleSpawner?.setPlayerPowerupInvincible(active);
            };
            this.player.onPowerupDash = (active: boolean) => {
                if (active) {
                    this.uiManager?.updateDashStatus(true, this.player!.POWERUP_DASH_DURATION);
                } else {
                    this.uiManager?.updateDashStatus(false);
                    // 冲刺结束时弹飞视野内所有障碍物，给予缓冲时间
                    if (this.player && this.obstacleSpawner) {
                        const playerPos = this.player.node.position;
                        this.obstacleSpawner.knockbackAllVisibleObstacles(playerPos.x, playerPos.y);
                    }
                }
                this.obstacleSpawner?.setPlayerPowerupDash(active);
            };
        }

        if (this.obstacleSpawner) {
            this.obstacleSpawner.startSpawning();
            this.obstacleSpawner.setScore(0);
        }

        if (this.magneticZoneManager) {
            this.magneticZoneManager.startZones();
            this.magneticZoneManager.setScore(0);
        }

        this.uiManager?.hideAllPanels();
        this.uiManager?.reset();
        this.uiManager?.updateLives(this.player ? this.player.lives : Player.prototype.MAX_LIVES);
        this.uiManager?.updatePoleIndicator(MagneticPole.N);
    }

    private restartGame() {
        this.obstacleSpawner?.stopSpawning();
        this.obstacleSpawner?.clearAll();
        this.magneticZoneManager?.stopZones();
        this.magneticZoneManager?.clearAll();
        this._isInBonusRoom = false;
        this._bonusRoomTimer = 0;
        this.uiManager?.updateBonusRoomStatus(false);
        this.startGame();
    }

    private gameOver() {
        this._state = GameState.GameOver;
        this.player?.die();
        this.obstacleSpawner?.stopSpawning();
        this.magneticZoneManager?.stopZones();
        this.uiManager?.showGameOverPanel();
    }

    update(_dt: number) {
        if (!this._initialized) return;
        if (this._state !== GameState.Playing) return;

        // 奖励房间计时
        if (this._isInBonusRoom) {
            this._bonusRoomTimer -= _dt;
            if (this._bonusRoomTimer <= 0) {
                this.exitBonusRoom();
            } else {
                this.uiManager?.updateBonusRoomStatus(true, this._bonusRoomTimer);
            }
        }

        // 同步数据
        this.syncSystems();

        // 奖励房间内：只检测金币拾取，跳过碰撞和其他道具
        if (!this._isInBonusRoom) {
            // 碰撞检测
            this.checkCollision();

            // 无敌道具拾取检测
            this.checkInvincibleItemPickup();

            // 冲刺道具拾取检测
            this.checkDashItemPickup();

            // 奖励入口道具拾取检测
            this.checkBonusPortalPickup();

            // 计分
            this.checkScoring();
        }

        // 道具拾取检测（奖励房间内外都需要）
        this.checkCoinPickup();

        // 更新磁场反转视觉
        this.updateMagneticVisuals();
    }

    /**
     * 同步各系统数据
     */
    private syncSystems() {
        // 同步分数到生成器
        if (this.obstacleSpawner) {
            this.obstacleSpawner.setScore(this._score);
        }

        // 同步分数和速度到磁场区域管理器
        if (this.magneticZoneManager) {
            this.magneticZoneManager.setScore(this._score);
            this.magneticZoneManager.setScrollSpeed(this.obstacleSpawner?.getCurrentSpeed() || 300);
        }

        // 同步反转系数到玩家
        if (this.player && this.magneticZoneManager) {
            this.player.setReversalFactor(this.magneticZoneManager.reversalFactor);
        }

        // 同步反转区域过渡警告到障碍物生成器
        if (this.magneticZoneManager && this.obstacleSpawner) {
            const spawnY = this.obstacleSpawner.SPAWN_Y;
            const transition = this.magneticZoneManager.isNearTransition(spawnY);
            if (transition.near) {
                this.obstacleSpawner.setTransitionWarning(transition.enteringZone);
            }
        }
    }

    /**
     * 更新磁场反转相关视觉
     */
    private updateMagneticVisuals() {
        if (!this.magneticZoneManager) return;

        const factor = this.magneticZoneManager.reversalFactor;

        // 更新磁场视觉
        this.magneticField?.setReversalFactor(factor);

        // 更新UI磁场状态
        this.uiManager?.updateFieldStatus(factor);
    }

    /**
     * 碰撞检测 - 只在障碍物Y接近玩家Y时检测
     * 带磁极障碍物：玩家用相斥磁极靠近时弹飞，不再碰撞
     * 道具冲刺期间：撞到障碍物直接弹飞，不受伤
     */
    private checkCollision() {
        if (!this.player || !this.player.isAlive) return;
        if (this.player.isInvincible) return;

        const playerPos = this.player.node.position;
        const playerRadius = this.player.getCollisionRadius();
        const playerPole = this.player.currentPole;
        const isDashing = this.player.isPowerupDash;

        const obstacles = this.obstacleSpawner?.getObstacles();
        if (!obstacles) return;

        for (const obsNode of obstacles) {
            if (!obsNode.isValid) continue;
            const obstacle = obsNode.getComponent(Obstacle);
            if (!obstacle) continue;

            // 已被弹飞的障碍物不再碰撞
            if (obstacle.isKnockedBack) continue;

            // 只在Y范围内检测碰撞
            const obsY = obsNode.position.y;
            if (Math.abs(obsY - this.PLAYER_Y) > this.COLLISION_Y_RANGE + 50) {
                continue;
            }

            // 带磁极障碍物：检测相斥弹飞
            if (obstacle.charge !== ObstacleCharge.None) {
                const knocked = obstacle.checkRepelAndKnockback(
                    playerPos.x, playerPos.y, playerPole
                );
                if (knocked) {
                    // 成功弹飞！跳过碰撞，加额外分数，触发冲刺
                    this._score++;
                    this.uiManager?.updateScore(this._score);
                    this.player!.startDash();
                    continue;
                }
            }

            const rect = obstacle.getCollisionRect();

            // 圆形与矩形碰撞
            if (this.circleRectCollision(
                playerPos.x, playerPos.y, playerRadius,
                rect.cx, rect.cy, rect.halfW, rect.halfH
            )) {
                if (isDashing) {
                    // 冲刺期间：撞飞障碍物
                    const centerDx = playerPos.x - rect.cx;
                    const centerDy = playerPos.y - rect.cy;
                    const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
                    obstacle.forceKnockback(centerDx, centerDy, Math.max(centerDist, 10));
                    this._score++;
                    this.uiManager?.updateScore(this._score);
                } else {
                    // 正常碰撞：受伤
                    const alive = this.player!.takeDamage();
                    this.uiManager?.updateLives(this.player!.lives);
                    if (!alive) {
                        this.gameOver();
                    }
                    return;
                }
            }
        }
    }

    /**
     * 圆形与中心矩形碰撞检测
     */
    private circleRectCollision(
        cx: number, cy: number, cr: number,
        rx: number, ry: number, rhw: number, rhh: number
    ): boolean {
        const closestX = Math.max(rx - rhw, Math.min(cx, rx + rhw));
        const closestY = Math.max(ry - rhh, Math.min(cy, ry + rhh));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) < (cr * cr);
    }

    /**
     * 道具拾取检测
     * 冲刺期间只检查垂直距离，无视水平距离
     */
    private checkCoinPickup() {
        if (!this.player || !this.player.isAlive) return;

        const playerPos = this.player.node.position;
        const collectRadius = this.player.getCollectRadius();
        const isDashing = this.player.isPowerupDash;
        const verticalRange = this.player.POWERUP_DASH_COLLECT_VERTICAL_RANGE;

        const coins = this.obstacleSpawner?.getCoins();
        if (!coins) return;

        for (const coinNode of coins) {
            if (!coinNode.isValid) continue;
            const coin = coinNode.getComponent(Coin);
            if (!coin || coin.collected) continue;

            const coinPos = coinNode.position;

            if (isDashing) {
                // 冲刺期间：只检查垂直距离，无视水平距离
                const dy = Math.abs(playerPos.y - coinPos.y);
                if (dy < verticalRange + coin.getCollisionRadius()) {
                    coin.collect();
                    this._score += coin.value;
                    this.uiManager?.updateScore(this._score);
                }
            } else {
                const dx = playerPos.x - coinPos.x;
                const dy = playerPos.y - coinPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < collectRadius + coin.getCollisionRadius()) {
                    coin.collect();
                    this._score += coin.value;
                    this.uiManager?.updateScore(this._score);
                }
            }
        }
    }

    /**
     * 无敌道具拾取检测
     * 冲刺期间只检查垂直距离，无视水平距离
     */
    private checkInvincibleItemPickup() {
        if (!this.player || !this.player.isAlive) return;

        const playerPos = this.player.node.position;
        const collectRadius = this.player.getCollectRadius();
        const isDashing = this.player.isPowerupDash;
        const verticalRange = this.player.POWERUP_DASH_COLLECT_VERTICAL_RANGE;

        const items = this.obstacleSpawner?.getInvincibleItems();
        if (!items) return;

        for (const itemNode of items) {
            if (!itemNode.isValid) continue;
            const item = itemNode.getComponent(InvincibleItem);
            if (!item || item.collected) continue;

            const itemPos = itemNode.position;

            if (isDashing) {
                // 冲刺期间：只检查垂直距离，无视水平距离
                const dy = Math.abs(playerPos.y - itemPos.y);
                if (dy < verticalRange + item.getCollisionRadius()) {
                    item.collect();
                    this.player!.activatePowerupInvincible(item.duration);
                }
            } else {
                const dx = playerPos.x - itemPos.x;
                const dy = playerPos.y - itemPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < collectRadius + item.getCollisionRadius()) {
                    item.collect();
                    this.player!.activatePowerupInvincible(item.duration);
                }
            }
        }
    }

    /**
     * 冲刺道具拾取检测
     * 冲刺期间只检查垂直距离，无视水平距离
     */
    private checkDashItemPickup() {
        if (!this.player || !this.player.isAlive) return;

        const playerPos = this.player.node.position;
        const collectRadius = this.player.getCollectRadius();
        const isDashing = this.player.isPowerupDash;
        const verticalRange = this.player.POWERUP_DASH_COLLECT_VERTICAL_RANGE;

        const items = this.obstacleSpawner?.getDashItems();
        if (!items) return;

        for (const itemNode of items) {
            if (!itemNode.isValid) continue;
            const item = itemNode.getComponent(DashItem);
            if (!item || item.collected) continue;

            const itemPos = itemNode.position;

            if (isDashing) {
                // 冲刺期间：只检查垂直距离，无视水平距离
                const dy = Math.abs(playerPos.y - itemPos.y);
                if (dy < verticalRange + item.getCollisionRadius()) {
                    item.collect();
                    this.player!.activatePowerupDash(item.duration);
                }
            } else {
                const dx = playerPos.x - itemPos.x;
                const dy = playerPos.y - itemPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < collectRadius + item.getCollisionRadius()) {
                    item.collect();
                    this.player!.activatePowerupDash(item.duration);
                }
            }
        }
    }

    /**
     * 神秘奖励入口拾取检测
     */
    private checkBonusPortalPickup() {
        if (!this.player || !this.player.isAlive) return;

        const playerPos = this.player.node.position;
        const collectRadius = this.player.getCollectRadius();
        const isDashing = this.player.isPowerupDash;
        const verticalRange = this.player.POWERUP_DASH_COLLECT_VERTICAL_RANGE;

        const items = this.obstacleSpawner?.getBonusPortalItems();
        if (!items) return;

        for (const itemNode of items) {
            if (!itemNode.isValid) continue;
            const item = itemNode.getComponent(BonusPortalItem);
            if (!item || item.collected) continue;

            const itemPos = itemNode.position;

            if (isDashing) {
                const dy = Math.abs(playerPos.y - itemPos.y);
                if (dy < verticalRange + item.getCollisionRadius()) {
                    item.collect();
                    this.enterBonusRoom();
                }
            } else {
                const dx = playerPos.x - itemPos.x;
                const dy = playerPos.y - itemPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < collectRadius + item.getCollisionRadius()) {
                    item.collect();
                    this.enterBonusRoom();
                }
            }
        }
    }

    /**
     * 进入奖励房间
     */
    private enterBonusRoom() {
        this._isInBonusRoom = true;
        this._bonusRoomTimer = this.BONUS_ROOM_DURATION;

        // 通知玩家进入奖励房间
        if (this.player) {
            this.player.activateBonusRoom();
        }

        // 通知障碍物生成器进入奖励房间模式
        this.obstacleSpawner?.enterBonusRoom();

        // 显示奖励房间UI
        this.uiManager?.updateBonusRoomStatus(true, this.BONUS_ROOM_DURATION);
    }

    /**
     * 退出奖励房间
     */
    private exitBonusRoom() {
        this._isInBonusRoom = false;
        this._bonusRoomTimer = 0;

        // 通知玩家退出奖励房间
        if (this.player) {
            this.player.deactivateBonusRoom();
            // 给予缓冲无敌时间
            this.player.activatePowerupInvincible(this.BONUS_ROOM_BUFFER_INVINCIBLE);
        }

        // 通知障碍物生成器退出奖励房间模式
        this.obstacleSpawner?.exitBonusRoom();

        // 弹飞视野内所有障碍物，给予缓冲时间
        if (this.player && this.obstacleSpawner) {
            const playerPos = this.player.node.position;
            this.obstacleSpawner.knockbackAllVisibleObstacles(playerPos.x, playerPos.y);
        }

        // 隐藏奖励房间UI
        this.uiManager?.updateBonusRoomStatus(false);
    }

    /**
     * 检查计分 - 通过障碍物组加分
     */
    private checkScoring() {
        const obstacles = this.obstacleSpawner?.getObstacles();
        if (!obstacles) return;

        for (const obsNode of obstacles) {
            if (!obsNode.isValid) continue;
            const obstacle = obsNode.getComponent(Obstacle);
            if (!obstacle || !obstacle.passed) continue;

            const groupId = obsNode['_groupId'] as number;
            if (groupId === undefined) continue;

            // 每组只计分一次
            if (!this._scoredGroups.has(groupId)) {
                this._scoredGroups.add(groupId);
                this._score++;
                this.uiManager?.updateScore(this._score);
            }
        }
    }

    public setPlayer(player: Player) { this.player = player; }
    public setObstacleSpawner(spawner: ObstacleSpawner) { this.obstacleSpawner = spawner; }
    public setUIManager(ui: UIManager) { this.uiManager = ui; }
    public setMagneticField(field: MagneticField) { this.magneticField = field; }
    public setMagneticZoneManager(manager: MagneticZoneManager) { this.magneticZoneManager = manager; }
}
