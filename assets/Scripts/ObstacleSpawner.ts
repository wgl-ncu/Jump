import { _decorator, Component, Node, UITransform, Size, Sprite, Color, Graphics, Material, resources, SpriteFrame, Vec4, EffectAsset } from 'cc';
import { Obstacle, ObstacleCharge } from './Obstacle';
import { Coin } from './Coin';
import { InvincibleItem } from './InvincibleItem';
import { DashItem } from './DashItem';
import { BonusPortalItem } from './BonusPortalItem';
const { ccclass, property } = _decorator;

/**
 * 障碍物生成器 - 纵向卷轴版
 *
 * 障碍物从屏幕底部生成，向上移动
 * 支持带磁极障碍物生成
 */
@ccclass('ObstacleSpawner')
export class ObstacleSpawner extends Component {
    private static readonly WALL_HEIGHT = 1400;
    private static readonly FIELD_VEIL_WIDTH = 92;
    private static readonly WALL_MATERIAL_PATH = 'Effects/WallGlow';
    private static readonly FIELD_GLOW_STRENGTH = 0.92;
    private static readonly FIELD_LINE_GAP = 150;
    private static readonly FIELD_VISUAL_SPEED_SCALE = 0.45;
    private static readonly FIELD_OVERLAY_PATH = 'Art/Map/MagneticFieldOverlay/spriteFrame';
    private static readonly FIELD_OVERLAY_EFFECT_PATH = 'Effects/MagneticFieldOverlay';


    @property({ tooltip: '生成间隔（秒）' })
    public spawnInterval: number = 1.8;

    @property({ tooltip: '障碍物移动速度（像素/秒）' })
    public moveSpeed: number = 300;

    @property({ tooltip: '最小生成间隔' })
    public minSpawnInterval: number = 0.9;

    @property({ tooltip: '速度随时间增加' })
    public speedIncrease: number = 15;

    @property({ tooltip: '间隔随时间减少' })
    public intervalDecrease: number = 0.02;

    /** 场景宽度 */
    @property({ tooltip: '场景宽度' })
    public screenWidth: number = 720;

    /** 玩家检测线Y位置 */
    @property({ tooltip: '玩家检测线Y' })
    public playerLineY: number = 200;

    /** 左墙宽度 */
    @property({ tooltip: '左墙宽度' })
    public wallWidth: number = 40;

    /** 右墙宽度 */
    @property({ tooltip: '右墙宽度' })
    public wallWidthRight: number = 40;

    /** 通道最小间隙（像素） */
    @property({ tooltip: '通道最小间隙' })
    public minGapWidth: number = 180;

    /** 通道最大间隙（像素） */
    @property({ tooltip: '通道最大间隙' })
    public maxGapWidth: number = 240;

    /** 障碍物行高 */
    @property({ tooltip: '障碍物行高' })
    public rowHeight: number = 40;

    /** 带磁极障碍物出现的最低分数 */
    @property({ tooltip: '磁极障碍物最低分数' })
    public minScoreForCharged: number = 10;

    /** 上一次是否为带磁极行 */
    private _lastRowCharged: boolean = false;

    /** 计时器 */
    private _timer: number = 0;

    /** 当前速度 */
    private _currentSpeed: number = 300;

    /** 当前间隔 */
    private _currentInterval: number = 1.8;

    /** 所有活跃障碍物 */
    private _obstacles: Node[] = [];

    /** 所有活跃道具 */
    private _coins: Node[] = [];

    /** 所有活跃无敌道具 */
    private _invincibleItems: Node[] = [];

    /** 道具生成概率（每行障碍物后） */
    @property({ tooltip: '道具生成概率' })
    public coinSpawnChance: number = 0.5;

    /** 道具分值 */
    @property({ tooltip: '道具分值' })
    public coinValue: number = 3;

    /** 无敌道具生成概率（每行障碍物后） */
    @property({ tooltip: '无敌道具生成概率' })
    public invincibleItemSpawnChance: number = 0.03;

    /** 无敌道具最低出现分数 */
    @property({ tooltip: '无敌道具最低出现分数' })
    public invincibleItemMinScore: number = 5;

    /** 玩家是否处于道具无敌状态（由GameManager同步） */
    private _playerPowerupInvincible: boolean = false;

    /** 所有活跃冲刺道具 */
    private _dashItems: Node[] = [];

    /** 冲刺道具生成概率（每行障碍物后） */
    @property({ tooltip: '冲刺道具生成概率' })
    public dashItemSpawnChance: number = 0.04;

    /** 冲刺道具最低出现分数 */
    @property({ tooltip: '冲刺道具最低出现分数' })
    public dashItemMinScore: number = 8;

    /** 玩家是否处于道具冲刺状态（由GameManager同步） */
    private _playerPowerupDash: boolean = false;

    /** 当前道具冲刺速度系数（相对普通冲刺） */
    private _playerPowerupDashScale: number = 1;

    /** ========= 神秘奖励入口 ========= */

    /** 所有活跃奖励入口道具 */
    private _bonusPortalItems: Node[] = [];

    /** 奖励入口道具生成概率（每行障碍物后） */
    @property({ tooltip: '奖励入口生成概率' })
    public bonusPortalSpawnChance: number = 0.02;

    /** 奖励入口最低出现分数 */
    @property({ tooltip: '奖励入口最低出现分数' })
    public bonusPortalMinScore: number = 15;

    /** 是否处于奖励房间模式 */
    private _isInBonusRoom: boolean = false;
    public get isInBonusRoom(): boolean { return this._isInBonusRoom; }

    /** 奖励房间金币生成计时 */
    private _bonusCoinSpawnTimer: number = 0;

    /** 奖励房间金币生成间隔 */
    private readonly BONUS_COIN_SPAWN_INTERVAL: number = 0.2;

    /** 奖励房间金币每行数量 */
    private readonly BONUS_COINS_PER_ROW: number = 7;

    /** 奖励房间金币分值 */
    private readonly BONUS_COIN_VALUE: number = 2;

    /** 奖励房间金色遮罩 */
    private _bonusOverlay: Node | null = null;

    /** 冲刺速度倍率 */
    private readonly DASH_SPEED_MULT: number = 1.8;

    public get powerupDashSpeedMultiplier(): number {
        return this.DASH_SPEED_MULT;
    }

    /** 当前冲刺速度倍率（1=正常, 1.8=冲刺中） */
    private _dashSpeedMult: number = 1;

    /** 障碍物生成Y位置 */
    public readonly SPAWN_Y: number = -700;

    /** 反转区域过渡警告：下一个生成的行应为固定磁极障碍物 */
    private _transitionWarning: boolean = false;

    /** 过渡类型：true=即将进入反转区域, false=即将离开反转区域 */
    private _transitionEnteringZone: boolean = false;

    /** 游戏是否运行 */
    private _running: boolean = false;

    /** 难度递增计时 */
    private _difficultyTimer: number = 0;

    /** 障碍物组ID */
    private _groupIdCounter: number = 0;

    /** 左墙节点 */
    private _leftWall: Node | null = null;

    /** 右墙节点 */
    private _rightWall: Node | null = null;

    /** 墙壁滚动偏移 */
    private _wallOffset: number = 0;

    /** Continuous shader time for magnetic overlay, never wrapped per line gap. */
    private _fieldShaderTime: number = 0;

    private _wallMaterialAsset: Material | null = null;
    private _leftWallMaterials: Material[] = [];
    private _rightWallMaterials: Material[] = [];

    /** 墙壁辉光材质资源 */

    /** 左墙辉光材质 */

    /** 右墙辉光材质 */

    /** Magnetic field line drawing layer */
    private _fieldLineGraphics: Graphics | null = null;

    private _fieldOverlaySprites: Sprite[] = [];
    private _fieldOverlayNodes: Node[] = [];
    private _fieldOverlayMaterials: Material[] = [];
    private _usingFieldOverlay: boolean = false;

    /** 当前分数（用于难度判断） */
    private _currentScore: number = 0;

    start() {
        this._currentSpeed = this.moveSpeed;
        this._currentInterval = this.spawnInterval;
        this.createWalls();
    }

    /**
     * 创建左右墙壁纯色辉光效果
     */
    private createWalls() {
        this.createMagneticFieldLayer();
    }

    private createWallNode(
        name: string,
        x: number,
        _width: number,
        spritePath: string,
        baseColor: Color,
        glowColor: Color,
        glowToRight: boolean,
    ): Node {
        const node = new Node(name);
        node.setPosition(x, 0, 0);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(1, ObstacleSpawner.WALL_HEIGHT));

        const veilSprite = this.createWallGlowSprite(
            node,
            `${name}_Veil`,
            ObstacleSpawner.FIELD_VEIL_WIDTH,
            glowToRight,
        );

        this.bindWallVisuals([veilSprite], spritePath, baseColor, glowColor, glowToRight);

        return node;
    }

    private createWallGlowSprite(parent: Node, name: string, glowWidth: number, glowToRight: boolean): Sprite {
        const glowNode = new Node(name);
        glowNode.setParent(parent);
        glowNode.setPosition(glowToRight ? glowWidth * 0.5 : -glowWidth * 0.5, 0, 0);

        const glowUT = glowNode.addComponent(UITransform);
        glowUT.setContentSize(new Size(glowWidth, ObstacleSpawner.WALL_HEIGHT));

        const glowSprite = glowNode.addComponent(Sprite);
        glowSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        glowSprite.type = Sprite.Type.SIMPLE;
        glowSprite.color = Color.WHITE;
        return glowSprite;
    }

    /**
     * 绑定墙体本体和辉光层。
     */
    private bindWallVisuals(
        glowSprites: Sprite[],
        spritePath: string,
        baseColor: Color,
        glowColor: Color,
        glowToRight: boolean,
    ) {
        resources.load(spritePath, SpriteFrame, (spriteErr, spriteFrame) => {
            if (spriteErr || !spriteFrame) {
                console.warn(`[ObstacleSpawner] Failed to load field sprite frame: ${spritePath}`, spriteErr);
                return;
            }

            if (glowSprites.some(sprite => !sprite.node.isValid)) return;

            for (const glowSprite of glowSprites) {
                glowSprite.spriteFrame = spriteFrame;
            }

            this.loadWallMaterial((wallMaterialAsset) => {
                if (glowSprites.some(sprite => !sprite.node.isValid)) return;

                const glowMaterials = glowSprites.map((glowSprite) => {
                    const glowMaterial = new Material();
                    glowMaterial.copy(wallMaterialAsset);
                    glowSprite.customMaterial = glowMaterial;
                    this.updateWallMaterial(glowMaterial, baseColor, glowColor, glowToRight, this._wallOffset, 0, ObstacleSpawner.FIELD_GLOW_STRENGTH);
                    return glowMaterial;
                });

                if (glowToRight) {
                    this._leftWallMaterials = glowMaterials;
                } else {
                    this._rightWallMaterials = glowMaterials;
                }
            });
        });
    }

    private loadWallMaterial(onLoaded: (wallMaterialAsset: Material) => void) {
        if (this._wallMaterialAsset) {
            onLoaded(this._wallMaterialAsset);
            return;
        }

        resources.load(ObstacleSpawner.WALL_MATERIAL_PATH, Material, (materialErr, wallMaterialAsset) => {
            if (materialErr || !wallMaterialAsset) {
                console.warn('[ObstacleSpawner] Failed to load wall glow material', materialErr);
                return;
            }

            this._wallMaterialAsset = wallMaterialAsset;
            onLoaded(wallMaterialAsset);
        });
    }

    private updateWallMaterial(
        material: Material,
        baseColor: Color,
        glowColor: Color,
        glowToRight: boolean,
        offset: number,
        coreRatio: number,
        glowStrength: number,
    ) {
        material.setProperty('baseColor', this.toShaderColor(baseColor));
        material.setProperty('glowColor', this.toShaderColor(glowColor));
        material.setProperty('wallParams', new Vec4(glowToRight ? 1 : 0, offset / 84, coreRatio, glowStrength));
    }

    private toShaderColor(color: Color): Vec4 {
        return new Vec4(color.r / 255, color.g / 255, color.b / 255, color.a / 255);
    }

    private refreshWallGlow() {
        this.refreshWallMaterialGroup(
            this._leftWallMaterials,
            new Color(200, 80, 40, 255),
            new Color(255, 150, 96, 255),
            true,
        );

        this.refreshWallMaterialGroup(
            this._rightWallMaterials,
            new Color(40, 120, 200, 255),
            new Color(118, 196, 255, 255),
            false,
        );
    }

    private refreshWallMaterialGroup(materials: Material[], baseColor: Color, glowColor: Color, glowToRight: boolean) {
        if (materials.length === 0) return;

        for (let i = 0; i < materials.length; i++) {
            this.updateWallMaterial(
                materials[i],
                baseColor,
                glowColor,
                glowToRight,
                this._wallOffset,
                0,
                ObstacleSpawner.FIELD_GLOW_STRENGTH,
            );
        }
    }

    private createMagneticFieldLayer() {
        const fieldNode = new Node('MagneticFieldLines');
        fieldNode.setParent(this.node);
        fieldNode.setPosition(0, 0, 0);
        const ut = fieldNode.addComponent(UITransform);
        ut.setContentSize(new Size(this.screenWidth, ObstacleSpawner.WALL_HEIGHT));
        this._fieldLineGraphics = fieldNode.addComponent(Graphics);
        this.drawMagneticFieldLines();
        this.tryLoadMagneticFieldOverlay();
    }

    private tryLoadMagneticFieldOverlay() {
        resources.load(ObstacleSpawner.FIELD_OVERLAY_PATH, SpriteFrame, (err, spriteFrame) => {
            if (err || !spriteFrame || !this.node.isValid) {
                return;
            }

            this._usingFieldOverlay = true;
            if (this._fieldLineGraphics) {
                this._fieldLineGraphics.clear();
            }

            const overlayHeight = ObstacleSpawner.WALL_HEIGHT;
            const overlayCount = 1;
            for (let i = 0; i < overlayCount; i++) {
                const overlayNode = new Node(`MagneticFieldOverlay_${i}`);
                overlayNode.setParent(this.node);
                overlayNode.setPosition(0, 0, 0);
                overlayNode.setSiblingIndex(0);

                const overlayUT = overlayNode.addComponent(UITransform);
                overlayUT.setContentSize(new Size(this.screenWidth, overlayHeight));

                const overlaySprite = overlayNode.addComponent(Sprite);
                overlaySprite.sizeMode = Sprite.SizeMode.CUSTOM;
                overlaySprite.type = Sprite.Type.SIMPLE;
                overlaySprite.spriteFrame = spriteFrame;
                overlaySprite.color = Color.WHITE;

                this._fieldOverlayNodes.push(overlayNode);
                this._fieldOverlaySprites.push(overlaySprite);
            }

            this.tryApplyMagneticFieldOverlayMaterial();
        });
    }

    private tryApplyMagneticFieldOverlayMaterial() {
        resources.load(ObstacleSpawner.FIELD_OVERLAY_EFFECT_PATH, EffectAsset, (err, effectAsset) => {
            if (err || !effectAsset || this._fieldOverlaySprites.length === 0) {
                return;
            }

            this._fieldOverlayMaterials = [];
            for (const overlaySprite of this._fieldOverlaySprites) {
                if (!overlaySprite.node.isValid) continue;

                const material = new Material();
                material.initialize({ effectAsset });
                this.bindOverlayTexture(material, overlaySprite);
                overlaySprite.customMaterial = material;
                this._fieldOverlayMaterials.push(material);
            }

            this.updateMagneticFieldOverlay();
        });
    }

    private bindOverlayTexture(material: Material, overlaySprite: Sprite) {
        const spriteFrame = overlaySprite.spriteFrame as any;
        const texture = spriteFrame?.texture ?? spriteFrame?.getTexture?.();
        if (texture) {
            material.setProperty('mainTexture', texture);
        }
    }

    private advanceFieldVisuals(dt: number) {
        const visualSpeed = this._running
            ? this._currentSpeed * this._dashSpeedMult
            : this.moveSpeed * 0.18;
        const fieldVisualSpeed = visualSpeed * ObstacleSpawner.FIELD_VISUAL_SPEED_SCALE;
        this._wallOffset += fieldVisualSpeed * dt;
        this._fieldShaderTime += (fieldVisualSpeed / ObstacleSpawner.FIELD_LINE_GAP) * dt;
        this._wallOffset %= ObstacleSpawner.FIELD_LINE_GAP;
        if (this._usingFieldOverlay) {
            this.updateMagneticFieldOverlay();
        } else {
            this.drawMagneticFieldLines();
        }
    }

    private updateMagneticFieldOverlay() {
        if (this._fieldOverlayNodes.length === 0) return;

        for (const material of this._fieldOverlayMaterials) {
            material.setProperty('fieldParams', new Vec4(
                this._fieldShaderTime,
                0,
                0,
                0.78,
            ));
        }
    }

    private drawMagneticFieldLines() {
        if (this._usingFieldOverlay) return;
        if (!this._fieldLineGraphics) return;

        const gfx = this._fieldLineGraphics;
        gfx.clear();

        const halfW = this.screenWidth / 2;
        const halfH = ObstacleSpawner.WALL_HEIGHT / 2;
        this.drawFieldVeil(gfx, halfW, halfH);

        const leftX = -halfW + this.wallWidth * 0.45;
        const rightX = halfW - this.wallWidthRight * 0.45;
        const gap = ObstacleSpawner.FIELD_LINE_GAP;
        const yOffset = this._wallOffset % gap;
        const lineCount = Math.ceil(ObstacleSpawner.WALL_HEIGHT / gap) + 2;

        for (let i = -1; i < lineCount; i++) {
            const y = -halfH + i * gap + yOffset;
            const phase = i * 0.73 + this._wallOffset * 0.018;
            const arch = 38 + Math.sin(phase) * 18;
            const warm = i % 2 === 0;

            gfx.strokeColor = warm
                ? new Color(255, 214, 154, 96)
                : new Color(152, 246, 255, 102);
            gfx.lineWidth = i % 3 === 0 ? 3.0 : 1.7;
            gfx.moveTo(leftX, y);
            gfx.bezierCurveTo(
                -halfW * 0.35,
                y + arch,
                halfW * 0.35,
                y + arch,
                rightX,
                y,
            );
            gfx.stroke();

            if (i % 2 === 0) {
                gfx.strokeColor = new Color(255, 255, 255, 58);
                gfx.lineWidth = 1.1;
                gfx.moveTo(leftX + 18, y + 20);
                gfx.bezierCurveTo(
                    -halfW * 0.22,
                    y + arch + 26,
                    halfW * 0.22,
                    y + arch + 26,
                    rightX - 18,
                    y + 20,
                );
                gfx.stroke();
            }

            this.drawFieldCharge(gfx, leftX, rightX, y, arch, phase, warm);
        }

        this.drawCenterFieldVortex(gfx);
    }

    private drawFieldVeil(gfx: Graphics, halfW: number, halfH: number) {
        const veilW = ObstacleSpawner.FIELD_VEIL_WIDTH;
        const strips = 18;
        const stripW = veilW / strips;
        const pulse = 0.5 + 0.5 * Math.sin(this._wallOffset * 0.06);

        for (let i = 0; i < strips; i++) {
            const t = i / (strips - 1);
            const fade = Math.pow(1 - t, 2.35);
            const leftAlpha = Math.floor((20 + pulse * 10) * fade);
            const rightAlpha = Math.floor((22 + (1 - pulse) * 10) * fade);

            gfx.fillColor = new Color(255, 128, 78, leftAlpha);
            gfx.rect(-halfW + i * stripW, -halfH, stripW + 1, halfH * 2);
            gfx.fill();

            gfx.fillColor = new Color(72, 203, 255, rightAlpha);
            gfx.rect(halfW - (i + 1) * stripW, -halfH, stripW + 1, halfH * 2);
            gfx.fill();
        }

        gfx.strokeColor = new Color(255, 220, 164, 46);
        gfx.lineWidth = 2.2;
        gfx.moveTo(-halfW + 22, -halfH);
        gfx.bezierCurveTo(-halfW + 48, -halfH * 0.45, -halfW + 38, halfH * 0.3, -halfW + 20, halfH);
        gfx.stroke();

        gfx.strokeColor = new Color(168, 248, 255, 52);
        gfx.moveTo(halfW - 22, -halfH);
        gfx.bezierCurveTo(halfW - 48, -halfH * 0.45, halfW - 38, halfH * 0.3, halfW - 20, halfH);
        gfx.stroke();
    }

    private drawFieldCharge(gfx: Graphics, leftX: number, rightX: number, y: number, arch: number, phase: number, warm: boolean) {
        const t = ((this._wallOffset * 0.006 + phase * 0.17) % 1 + 1) % 1;
        const x = leftX + (rightX - leftX) * t;
        const chargeY = y + Math.sin(t * Math.PI) * arch;
        const radius = warm ? 2.2 : 1.8;

        gfx.fillColor = warm
            ? new Color(255, 228, 176, 205)
            : new Color(191, 251, 255, 215);
        gfx.circle(x, chargeY, radius);
        gfx.fill();
    }

    private drawCenterFieldVortex(gfx: Graphics) {
        const pulse = 0.5 + 0.5 * Math.sin(this._wallOffset * 0.08);
        const centerAlpha = Math.floor(34 + pulse * 30);
        const halfW = this.screenWidth / 2;

        gfx.strokeColor = new Color(255, 255, 255, centerAlpha);
        gfx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const y = -90 + i * 95 + Math.sin(this._wallOffset * 0.025 + i) * 10;
            const inset = 110 + i * 18;
            gfx.moveTo(-halfW + inset, y);
            gfx.bezierCurveTo(-70, y + 34, 70, y + 34, halfW - inset, y);
            gfx.stroke();
        }

        gfx.strokeColor = new Color(255, 218, 160, Math.floor(44 + pulse * 24));
        gfx.lineWidth = 1.2;
        gfx.moveTo(-halfW + 126, 170);
        gfx.bezierCurveTo(-70, 205, 70, 205, halfW - 126, 170);
        gfx.stroke();

        gfx.strokeColor = new Color(165, 248, 255, Math.floor(44 + (1 - pulse) * 24));
        gfx.moveTo(-halfW + 120, -230);
        gfx.bezierCurveTo(-60, -194, 60, -194, halfW - 120, -230);
        gfx.stroke();
    }

    /**
     * 普通障碍物缺口范围。
     * 前期保持更宽，后期才以较低概率出现相对较窄的通道。
     */
    private getNormalGapRange(): { min: number, max: number } {
        const baseMin = this.minGapWidth;
        const baseMax = Math.max(baseMin + 20, this.maxGapWidth);

        if (this._currentScore < 12) {
            return { min: baseMin + 40, max: baseMax + 30 };
        }

        if (this._currentScore < 24) {
            return { min: baseMin + 20, max: baseMax + 15 };
        }

        if (this._currentScore < 36) {
            return { min: baseMin + 10, max: baseMax + 5 };
        }

        // 后期仍以中等偏宽为主，仅低概率生成相对较窄缺口。
        if (Math.random() < 0.15) {
            return { min: baseMin, max: baseMin + 24 };
        }

        return { min: baseMin + 8, max: baseMax };
    }

    public startSpawning() {
        this._running = true;
        this._timer = 0;
        this._difficultyTimer = 0;
        this._currentSpeed = this.moveSpeed;
        this._currentInterval = this.spawnInterval;
        this._groupIdCounter = 0;
        this._transitionWarning = false;
        this.clearAll();
    }

    public stopSpawning() {
        this._running = false;
    }

    public setScore(score: number) {
        this._currentScore = score;
    }

    public setPlayerPowerupInvincible(active: boolean) {
        this._playerPowerupInvincible = active;
    }

    public setPlayerPowerupDash(active: boolean, speedScale: number = 1) {
        const nextScale = active ? Math.max(1, speedScale) : 1;
        const previousDashMult = this._playerPowerupDash
            ? this.DASH_SPEED_MULT * this._playerPowerupDashScale
            : 1;
        const nextDashMult = active
            ? this.DASH_SPEED_MULT * nextScale
            : 1;

        if (this._playerPowerupDash === active && this._playerPowerupDashScale === nextScale) {
            return;
        }

        this._playerPowerupDash = active;
        this._playerPowerupDashScale = nextScale;
        this._dashSpeedMult = nextDashMult;

        if (previousDashMult !== nextDashMult) {
            this.applySpeedMultiplier(nextDashMult / previousDashMult);
        }
    }

    /**
     * 设置反转区域过渡警告
     * 下一个生成的行将被强制为固定磁极障碍物
     * @param enteringZone true=进入反转区域(用N极), false=离开反转区域(用S极)
     */
    public setTransitionWarning(enteringZone: boolean) {
        if (!this._transitionWarning) {
            this._transitionWarning = true;
            this._transitionEnteringZone = enteringZone;
        }
    }

    /**
     * 对所有活跃物体应用速度倍率
     */
    private applySpeedMultiplier(mult: number) {
        for (const obs of this._obstacles) {
            if (!obs.isValid) continue;
            const obstacle = obs.getComponent(Obstacle);
            if (obstacle && !obstacle.isKnockedBack) obstacle.speed *= mult;
        }
        for (const coin of this._coins) {
            if (!coin.isValid) continue;
            const c = coin.getComponent(Coin);
            if (c) c.speed *= mult;
        }
        for (const item of this._invincibleItems) {
            if (!item.isValid) continue;
            const ii = item.getComponent(InvincibleItem);
            if (ii) ii.speed *= mult;
        }
        for (const item of this._dashItems) {
            if (!item.isValid) continue;
            const di = item.getComponent(DashItem);
            if (di) di.speed *= mult;
        }
        for (const item of this._bonusPortalItems) {
            if (!item.isValid) continue;
            const bp = item.getComponent(BonusPortalItem);
            if (bp) bp.speed *= mult;
        }
    }

    public clearAll() {
        for (const obs of this._obstacles) {
            if (obs.isValid) obs.destroy();
        }
        this._obstacles = [];
        for (const coin of this._coins) {
            if (coin.isValid) coin.destroy();
        }
        this._coins = [];
        for (const item of this._invincibleItems) {
            if (item.isValid) item.destroy();
        }
        this._invincibleItems = [];
        for (const item of this._dashItems) {
            if (item.isValid) item.destroy();
        }
        this._dashItems = [];
        for (const item of this._bonusPortalItems) {
            if (item.isValid) item.destroy();
        }
        this._bonusPortalItems = [];
        this.removeBonusOverlay();
        this._isInBonusRoom = false;
    }

    update(dt: number) {
        this.advanceFieldVisuals(dt);

        if (!this._running) return;

        if (this._isInBonusRoom) {
            // 奖励房间模式：只生成金币，不生成障碍物
            this._bonusCoinSpawnTimer += dt;
            if (this._bonusCoinSpawnTimer >= this.BONUS_COIN_SPAWN_INTERVAL) {
                this._bonusCoinSpawnTimer = 0;
                this.spawnBonusCoinRow();
            }

            // 滚动墙壁
            // 清理超出屏幕的障碍物（弹飞的）
            this._obstacles = this._obstacles.filter(obs => {
                if (!obs.isValid) return false;
                const obstacle = obs.getComponent(Obstacle);
                if (obstacle && obstacle.outOfScreen) {
                    obs.destroy();
                    return false;
                }
                return true;
            });

            // 清理超出屏幕的金币
            this._coins = this._coins.filter(coin => {
                if (!coin.isValid) return false;
                const c = coin.getComponent(Coin);
                if (c && (c.outOfScreen || c.collected)) {
                    if (coin.isValid) coin.destroy();
                    return false;
                }
                return true;
            });

            // 清理奖励入口道具
            this._bonusPortalItems = this._bonusPortalItems.filter(item => {
                if (!item.isValid) return false;
                const bp = item.getComponent(BonusPortalItem);
                if (bp && (bp.outOfScreen || bp.collected)) {
                    if (item.isValid) item.destroy();
                    return false;
                }
                return true;
            });

            return;
        }

        // 难度递增
        this._difficultyTimer += dt;
        if (this._difficultyTimer > 5) {
            this._difficultyTimer = 0;
            this._currentSpeed += this.speedIncrease;
            this._currentInterval = Math.max(this.minSpawnInterval, this._currentInterval - this.intervalDecrease);
        }

        // 生成计时
        this._timer += dt;
        // 带磁极行后额外增加0.4秒间隔，给玩家移动时间
        const extraInterval = this._lastRowCharged ? 0.4 : 0;
        if (this._timer >= this._currentInterval + extraInterval) {
            this._timer = 0;
            this.spawnObstacleRow();
        }

        // 滚动墙壁
        // 清理超出屏幕的障碍物
        this._obstacles = this._obstacles.filter(obs => {
            if (!obs.isValid) return false;
            const obstacle = obs.getComponent(Obstacle);
            if (obstacle && obstacle.outOfScreen) {
                obs.destroy();
                return false;
            }
            return true;
        });

        // 清理超出屏幕的道具
        this._coins = this._coins.filter(coin => {
            if (!coin.isValid) return false;
            const c = coin.getComponent(Coin);
            if (c && (c.outOfScreen || c.collected)) {
                if (coin.isValid) coin.destroy();
                return false;
            }
            return true;
        });

        // 清理超出屏幕的无敌道具
        this._invincibleItems = this._invincibleItems.filter(item => {
            if (!item.isValid) return false;
            const ii = item.getComponent(InvincibleItem);
            if (ii && (ii.outOfScreen || ii.collected)) {
                if (item.isValid) item.destroy();
                return false;
            }
            return true;
        });

        // 清理超出屏幕的冲刺道具
        this._dashItems = this._dashItems.filter(item => {
            if (!item.isValid) return false;
            const di = item.getComponent(DashItem);
            if (di && (di.outOfScreen || di.collected)) {
                if (item.isValid) item.destroy();
                return false;
            }
            return true;
        });

        // 清理超出屏幕的奖励入口道具
        this._bonusPortalItems = this._bonusPortalItems.filter(item => {
            if (!item.isValid) return false;
            const bp = item.getComponent(BonusPortalItem);
            if (bp && (bp.outOfScreen || bp.collected)) {
                if (item.isValid) item.destroy();
                return false;
            }
            return true;
        });
    }

    /**
     * 生成一行障碍物（中间留通道）
     * 根据分数概率生成带磁极障碍物
     */
    private spawnObstacleRow() {
        const groupId = this._groupIdCounter++;

        // 可用宽度（去掉左右墙）
        const playableLeft = -this.screenWidth / 2 + this.wallWidth;
        const playableRight = this.screenWidth / 2 - this.wallWidthRight;
        const playableWidth = playableRight - playableLeft;

        const spawnY = this.SPAWN_Y; // 在屏幕下方生成

        // 确定本行障碍物的磁荷
        let rowCharge: ObstacleCharge;
        if (this._transitionWarning) {
            // 反转区域过渡：强制固定磁极障碍物，给玩家缓冲时间
            // 进入反转区域 → N极(红), 离开反转区域 → S极(蓝)
            rowCharge = this._transitionEnteringZone ? ObstacleCharge.N : ObstacleCharge.S;
            this._transitionWarning = false; // 消耗警告
        } else {
            rowCharge = this.determineRowCharge();
        }
        let gapCenterX: number | undefined;
        let gapWidth: number | undefined;

        if (rowCharge !== ObstacleCharge.None) {
            // 带磁极障碍物：完全铺满不留空隙，玩家必须击飞才能通过
            const centerX = (playableLeft + playableRight) / 2;
            this.spawnObstacle(centerX, spawnY, playableWidth, this.rowHeight, 'charged', groupId, rowCharge);
        } else {
            const normalGapRange = this.getNormalGapRange();

            // 上一次是带磁极行，这次是普通行 → 增大缺口给玩家更多移动时间
            const gapMin = this._lastRowCharged ? normalGapRange.min + 60 : normalGapRange.min;
            const gapMax = this._lastRowCharged ? normalGapRange.max + 60 : normalGapRange.max;
            gapWidth = gapMin + Math.random() * (gapMax - gapMin);

            // 普通障碍物：中间留通道
            const minX = playableLeft + gapWidth / 2 + 10;
            const maxX = playableRight - gapWidth / 2 - 10;
            gapCenterX = minX + Math.random() * (maxX - minX);

            const gapLeft = gapCenterX - gapWidth / 2;
            const gapRight = gapCenterX + gapWidth / 2;

            // 左侧障碍物
            const leftBlockWidth = gapLeft - playableLeft;
            if (leftBlockWidth > 10) {
                const leftBlockX = playableLeft + leftBlockWidth / 2;
                this.spawnObstacle(leftBlockX, spawnY, leftBlockWidth, this.rowHeight, 'wall', groupId, ObstacleCharge.None);
            }

            // 右侧障碍物
            const rightBlockWidth = playableRight - gapRight;
            if (rightBlockWidth > 10) {
                const rightBlockX = gapRight + rightBlockWidth / 2;
                this.spawnObstacle(rightBlockX, spawnY, rightBlockWidth, this.rowHeight, 'wall', groupId, ObstacleCharge.None);
            }
        }

        this._lastRowCharged = (rowCharge !== ObstacleCharge.None);

        // 生成积分道具
        this.trySpawnCoin(rowCharge, spawnY, gapCenterX, gapWidth);

        // 生成无敌道具
        this.trySpawnInvincibleItem(rowCharge, spawnY, gapCenterX, gapWidth);

        // 生成冲刺道具
        this.trySpawnDashItem(rowCharge, spawnY, gapCenterX, gapWidth);

        // 生成神秘奖励入口
        this.trySpawnBonusPortal(rowCharge, spawnY, gapCenterX, gapWidth);
    }

    /**
     * 尝试在安全位置生成积分道具
     * - 普通行：道具在缺口范围内随机位置，确保在缺口内可拾取
     * - 带磁极行：道具在行上方随机X位置，击飞后自然拾取
     */
    private trySpawnCoin(rowCharge: ObstacleCharge, rowY: number, gapCenterX?: number, gapWidth?: number) {
        if (Math.random() > this.coinSpawnChance) return;

        const playableLeft = -this.screenWidth / 2 + this.wallWidth;
        const playableRight = this.screenWidth / 2 - this.wallWidthRight;

        if (rowCharge === ObstacleCharge.None && gapCenterX !== undefined && gapWidth !== undefined) {
            // 普通行：道具在缺口范围内随机偏移，确保仍在缺口内
            const maxOffset = gapWidth / 2 - 25; // 留出道具半径余量
            const offsetX = (Math.random() - 0.5) * 2 * Math.max(0, maxOffset);
            const coinX = gapCenterX + offsetX;
            // Y方向也随机偏移，在行高范围内上下浮动
            const offsetY = (Math.random() - 0.5) * this.rowHeight * 0.6;
            const coinY = rowY + offsetY;
            this.spawnCoin(coinX, coinY);
        } else {
            // 带磁极行：道具在行上方随机X位置
            const margin = 30;
            const coinX = playableLeft + margin + Math.random() * (playableRight - playableLeft - margin * 2);
            const coinY = rowY + this.rowHeight / 2 + 20 + Math.random() * 20;
            this.spawnCoin(coinX, coinY);
        }
    }

    /**
     * 生成单个道具
     */
    private spawnCoin(x: number, y: number) {
        const node = new Node('Coin');
        node.addComponent(UITransform).setContentSize(new Size(40, 40));
        const coin = node.addComponent(Coin);
        coin.speed = this._currentSpeed * this._dashSpeedMult;
        coin.value = this.coinValue;

        node.setParent(this.node);
        node.setPosition(x, y, 0);
        node.active = true;

        this._coins.push(node);
    }

    /**
     * 尝试生成无敌道具
     * 概率较低，且需要达到一定分数
     */
    private trySpawnInvincibleItem(rowCharge: ObstacleCharge, rowY: number, gapCenterX?: number, gapWidth?: number) {
        if (this._currentScore < this.invincibleItemMinScore) return;
        if (this._playerPowerupInvincible) return;
        if (Math.random() > this.invincibleItemSpawnChance) return;

        const playableLeft = -this.screenWidth / 2 + this.wallWidth;
        const playableRight = this.screenWidth / 2 - this.wallWidthRight;

        let itemX: number;
        let itemY: number;

        if (rowCharge === ObstacleCharge.None && gapCenterX !== undefined && gapWidth !== undefined) {
            // 普通行：在缺口范围内生成
            const maxOffset = gapWidth / 2 - 30;
            const offsetX = (Math.random() - 0.5) * 2 * Math.max(0, maxOffset);
            itemX = gapCenterX + offsetX;
            itemY = rowY + 50 + Math.random() * 30;
        } else {
            // 带磁极行：在行上方随机位置
            const margin = 40;
            itemX = playableLeft + margin + Math.random() * (playableRight - playableLeft - margin * 2);
            itemY = rowY + this.rowHeight / 2 + 40 + Math.random() * 20;
        }

        this.spawnInvincibleItem(itemX, itemY);
    }

    /**
     * 生成单个无敌道具
     */
    private spawnInvincibleItem(x: number, y: number) {
        const node = new Node('InvincibleItem');
        node.addComponent(UITransform).setContentSize(new Size(50, 50));
        const item = node.addComponent(InvincibleItem);
        item.speed = this._currentSpeed * this._dashSpeedMult;

        node.setParent(this.node);
        node.setPosition(x, y, 0);
        node.active = true;

        this._invincibleItems.push(node);
    }

    /**
     * 尝试生成神秘奖励入口
     */
    private trySpawnBonusPortal(rowCharge: ObstacleCharge, rowY: number, gapCenterX?: number, gapWidth?: number) {
        if (this._currentScore < this.bonusPortalMinScore) return;
        if (this._isInBonusRoom) return;
        if (this._playerPowerupInvincible || this._playerPowerupDash) return;
        if (this._bonusPortalItems.length > 0) return; // 同时只存在一个入口
        if (Math.random() > this.bonusPortalSpawnChance) return;

        const playableLeft = -this.screenWidth / 2 + this.wallWidth;
        const playableRight = this.screenWidth / 2 - this.wallWidthRight;

        let itemX: number;
        let itemY: number;

        if (rowCharge === ObstacleCharge.None && gapCenterX !== undefined && gapWidth !== undefined) {
            const maxOffset = gapWidth / 2 - 30;
            const offsetX = (Math.random() - 0.5) * 2 * Math.max(0, maxOffset);
            itemX = gapCenterX + offsetX;
            itemY = rowY + 50 + Math.random() * 30;
        } else {
            const margin = 40;
            itemX = playableLeft + margin + Math.random() * (playableRight - playableLeft - margin * 2);
            itemY = rowY + this.rowHeight / 2 + 40 + Math.random() * 20;
        }

        this.spawnBonusPortalItem(itemX, itemY);
    }

    /**
     * 生成单个神秘奖励入口
     */
    private spawnBonusPortalItem(x: number, y: number) {
        const node = new Node('BonusPortal');
        node.addComponent(UITransform).setContentSize(new Size(50, 50));
        const item = node.addComponent(BonusPortalItem);
        item.speed = this._currentSpeed * this._dashSpeedMult;

        node.setParent(this.node);
        node.setPosition(x, y, 0);
        node.active = true;

        this._bonusPortalItems.push(node);
    }

    /**
     * 进入奖励房间模式
     * - 清除所有障碍物
     * - 停止生成障碍物
     * - 开始密集生成金币
     * - 显示金色遮罩
     */
    public enterBonusRoom() {
        this._isInBonusRoom = true;
        this._bonusCoinSpawnTimer = 0;

        // 弹飞所有现有障碍物
        for (const obs of this._obstacles) {
            if (!obs.isValid) continue;
            const obstacle = obs.getComponent(Obstacle);
            if (!obstacle || obstacle.isKnockedBack) continue;
            obstacle.forceKnockbackFrom(0, this.playerLineY, 1200);
        }

        // 创建金色遮罩
        this.createBonusOverlay();
    }

    /**
     * 退出奖励房间模式
     * - 恢复正常生成
     * - 隐藏金色遮罩
     */
    public exitBonusRoom() {
        this._isInBonusRoom = false;
        this._bonusCoinSpawnTimer = 0;

        // 移除金色遮罩
        this.removeBonusOverlay();
    }

    /**
     * 创建奖励房间金色遮罩
     */
    private createBonusOverlay() {
        if (this._bonusOverlay && this._bonusOverlay.isValid) {
            this._bonusOverlay.active = true;
            return;
        }

        this._bonusOverlay = new Node('BonusOverlay');
        const ut = this._bonusOverlay.addComponent(UITransform);
        ut.setContentSize(new Size(this.screenWidth, 1400));
        const sprite = this._bonusOverlay.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.color = new Color(255, 200, 50, 25); // 淡金色半透明

        this._bonusOverlay.setParent(this.node);
        this._bonusOverlay.setPosition(0, 0, 0);

        // 插入到最底层（在墙壁之前），这样遮罩不会挡住金币和障碍物
        const childCount = this.node.children.length;
        if (childCount > 0) {
            this.node.insertChild(this._bonusOverlay, 0);
        }
    }

    /**
     * 移除奖励房间金色遮罩
     */
    private removeBonusOverlay() {
        if (this._bonusOverlay && this._bonusOverlay.isValid) {
            this._bonusOverlay.destroy();
            this._bonusOverlay = null;
        }
    }

    /**
     * 奖励房间内生成金币行（整齐网格排列）
     */
    private spawnBonusCoinRow() {
        const playableLeft = -this.screenWidth / 2 + this.wallWidth + 20;
        const playableRight = this.screenWidth / 2 - this.wallWidthRight - 20;
        const playableWidth = playableRight - playableLeft;

        const spawnY = this.SPAWN_Y;

        // 生成一行金币，均匀整齐排列
        const coinCount = this.BONUS_COINS_PER_ROW;
        const spacing = playableWidth / (coinCount + 1);

        for (let i = 0; i < coinCount; i++) {
            const baseX = playableLeft + spacing * (i + 1);
            this.spawnBonusCoin(baseX, spawnY);
        }
    }

    /**
     * 生成单个奖励房间金币
     */
    private spawnBonusCoin(x: number, y: number) {
        const node = new Node('BonusCoin');
        node.addComponent(UITransform).setContentSize(new Size(40, 40));
        const coin = node.addComponent(Coin);
        coin.speed = this._currentSpeed * this._dashSpeedMult;
        coin.value = this.BONUS_COIN_VALUE;

        node.setParent(this.node);
        node.setPosition(x, y, 0);
        node.active = true;

        this._coins.push(node);
    }

    /**
     * 获取所有活跃奖励入口道具节点
     */
    public getBonusPortalItems(): Node[] {
        return this._bonusPortalItems.filter(i => i.isValid);
    }

    /**
     * 尝试生成冲刺道具
     */
    private trySpawnDashItem(rowCharge: ObstacleCharge, rowY: number, gapCenterX?: number, gapWidth?: number) {
        if (this._currentScore < this.dashItemMinScore) return;
        if (this._playerPowerupDash) return;
        if (Math.random() > this.dashItemSpawnChance) return;

        const playableLeft = -this.screenWidth / 2 + this.wallWidth;
        const playableRight = this.screenWidth / 2 - this.wallWidthRight;

        let itemX: number;
        let itemY: number;

        if (rowCharge === ObstacleCharge.None && gapCenterX !== undefined && gapWidth !== undefined) {
            const maxOffset = gapWidth / 2 - 30;
            const offsetX = (Math.random() - 0.5) * 2 * Math.max(0, maxOffset);
            itemX = gapCenterX + offsetX;
            itemY = rowY + 50 + Math.random() * 30;
        } else {
            const margin = 40;
            itemX = playableLeft + margin + Math.random() * (playableRight - playableLeft - margin * 2);
            itemY = rowY + this.rowHeight / 2 + 40 + Math.random() * 20;
        }

        this.spawnDashItem(itemX, itemY);
    }

    /**
     * 生成单个冲刺道具
     */
    private spawnDashItem(x: number, y: number) {
        const node = new Node('DashItem');
        node.addComponent(UITransform).setContentSize(new Size(50, 50));
        const item = node.addComponent(DashItem);
        item.speed = this._currentSpeed * this._dashSpeedMult;

        node.setParent(this.node);
        node.setPosition(x, y, 0);
        node.active = true;

        this._dashItems.push(node);
    }

    /**
     * 根据分数确定本行障碍物的磁荷
     * 分数10+：20%概率出现带磁极障碍物
     * 分数20+：35%概率
     * 分数30+：50%概率
     */
    private determineRowCharge(): ObstacleCharge {
        if (this._currentScore < this.minScoreForCharged) {
            return ObstacleCharge.None;
        }

        let chargeChance: number;
        if (this._currentScore < 20) {
            chargeChance = 0.20;
        } else if (this._currentScore < 30) {
            chargeChance = 0.35;
        } else {
            chargeChance = 0.50;
        }

        if (Math.random() > chargeChance) {
            return ObstacleCharge.None;
        }

        // 随机N或S
        return Math.random() < 0.5 ? ObstacleCharge.N : ObstacleCharge.S;
    }

    /**
     * 生成单个障碍物
     */
    private spawnObstacle(x: number, y: number, width: number, height: number, type: string, groupId: number, charge: ObstacleCharge = ObstacleCharge.None) {
        const node = this.createObstacleNode(width, height, type, charge);
        node.setParent(this.node);
        node.setPosition(x, y, 0);
        node.active = true;

        const obstacle = node.getComponent(Obstacle);
        if (obstacle) {
            obstacle.speed = this._currentSpeed * this._dashSpeedMult;
            obstacle.setHalfSize(width / 2, height / 2);
            obstacle.setPlayerLineY(this.playerLineY);
            obstacle.charge = charge;

            // 根据分数调整弹飞参数
            if (charge !== ObstacleCharge.None) {
                const strengthScale = Math.min(1.5, 1 + this._currentScore * 0.01);
                obstacle.knockbackSpeed = 2000 * strengthScale;
                obstacle.fieldRadius = 120 + Math.min(40, this._currentScore * 0.5);
            }
        }

        // 存储groupId
        node['_groupId'] = groupId;

        this._obstacles.push(node);
    }

    /**
     * 代码创建障碍物节点 - 用不同颜色表示磁荷
     */
    private createObstacleNode(width: number, height: number, type: string, charge: ObstacleCharge = ObstacleCharge.None): Node {
        const node = new Node('Obstacle_' + type + (charge !== ObstacleCharge.None ? '_' + (charge === ObstacleCharge.N ? 'N' : 'S') : ''));
        const uiTransform = node.addComponent(UITransform);
        uiTransform.setContentSize(new Size(width, height));

        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;

        // 根据磁荷设定颜色
        if (charge === ObstacleCharge.N) {
            // N极障碍物 - 红橙色
            sprite.color = new Color(220, 80, 60, 230);
        } else if (charge === ObstacleCharge.S) {
            // S极障碍物 - 青蓝色
            sprite.color = new Color(60, 100, 220, 230);
        } else {
            // 普通障碍物 - 绿色系
            sprite.color = new Color(60, 180, 80, 230);
        }

        // 装饰边框
        const gfxNode = new Node('Gfx');
        gfxNode.setParent(node);
        const gfxUT = gfxNode.addComponent(UITransform);
        gfxUT.setContentSize(new Size(width, height));
        const gfx = gfxNode.addComponent(Graphics);

        // 外框
        if (charge === ObstacleCharge.N) {
            gfx.strokeColor = new Color(255, 140, 100, 200);
        } else if (charge === ObstacleCharge.S) {
            gfx.strokeColor = new Color(100, 140, 255, 200);
        } else {
            gfx.strokeColor = new Color(100, 220, 120, 180);
        }
        gfx.lineWidth = 2;
        gfx.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 4);
        gfx.stroke();

        // 内部装饰线
        if (charge === ObstacleCharge.N) {
            gfx.strokeColor = new Color(180, 50, 30, 120);
        } else if (charge === ObstacleCharge.S) {
            gfx.strokeColor = new Color(30, 60, 180, 120);
        } else {
            gfx.strokeColor = new Color(40, 140, 60, 120);
        }
        gfx.lineWidth = 1;
        const stripeGap = 15;
        for (let i = -width / 2; i < width / 2; i += stripeGap) {
            gfx.moveTo(i, -height / 2 + 2);
            gfx.lineTo(i, height / 2 - 2);
        }
        gfx.stroke();

        // 带磁极障碍物的发光效果
        if (charge !== ObstacleCharge.None) {
            const isN = charge === ObstacleCharge.N;
            gfx.strokeColor = isN
                ? new Color(255, 80, 80, 60)
                : new Color(80, 80, 255, 60);
            gfx.lineWidth = 3;
            gfx.roundRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, 6);
            gfx.stroke();
        }

        // 障碍物组件
        node.addComponent(Obstacle);

        return node;
    }

    /**
     * 获取所有活跃障碍物节点
     */
    public getObstacles(): Node[] {
        return this._obstacles.filter(obs => obs.isValid);
    }

    /**
     * 获取所有活跃道具节点
     */
    public getCoins(): Node[] {
        return this._coins.filter(c => c.isValid);
    }

    /**
     * 获取所有活跃无敌道具节点
     */
    public getInvincibleItems(): Node[] {
        return this._invincibleItems.filter(i => i.isValid);
    }

    /**
     * 获取所有活跃冲刺道具节点
     */
    public getDashItems(): Node[] {
        return this._dashItems.filter(i => i.isValid);
    }

    /**
     * 获取当前速度
     */
    public getCurrentSpeed(): number {
        return this._currentSpeed * this._dashSpeedMult;
    }

    /**
     * 获取当前基础难度速度倍率（不包含冲刺倍率）
     */
    public getDifficultySpeedScale(): number {
        return this.moveSpeed > 0 ? this._currentSpeed / this.moveSpeed : 1;
    }

    /**
     * 冲刺结束时弹飞视野内所有障碍物
     * @param fromX 弹飞源点X（玩家位置）
     * @param fromY 弹飞源点Y（玩家位置）
     */
    public knockbackAllVisibleObstacles(fromX: number, fromY: number) {
        const visibleRange = 800; // 视野Y范围
        for (const obs of this._obstacles) {
            if (!obs.isValid) continue;
            const obstacle = obs.getComponent(Obstacle);
            if (!obstacle || obstacle.isKnockedBack) continue;

            // 只弹飞视野内的障碍物
            const obsY = obs.position.y;
            if (obsY > fromY - visibleRange && obsY < fromY + visibleRange) {
                obstacle.forceKnockbackFrom(fromX, fromY);
            }
        }
    }
}
