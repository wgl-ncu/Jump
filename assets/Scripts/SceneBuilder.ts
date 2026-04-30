import { _decorator, Component, Node, UITransform, Size, Sprite, SpriteFrame, Color, Label, Graphics, Canvas, Overflow, HorizontalTextAlignment, UIOpacity, resources, Prefab, instantiate } from 'cc';
import { Player, MagneticPole } from './Player';
import { ObstacleSpawner } from './ObstacleSpawner';
import { UIManager } from './UIManager';
import { MagneticField } from './MagneticField';
import { MagneticZoneManager } from './MagneticZoneManager';
import { TextManager } from './Data/TextManager';
import { TextId } from './Data/TextId';
const { ccclass } = _decorator;

type CloudDriftState = {
    node: Node;
    baseX: number;
    baseSpeed: number;
    swayAmplitude: number;
    swayFrequency: number;
    phase: number;
};

type BackgroundStar = {
    x: number;
    y: number;
    radius: number;
    alpha: number;
    twinkle: number;
    phase: number;
    speed: number;
};

type BackgroundMist = {
    x: number;
    y: number;
    width: number;
    height: number;
    alpha: number;
    speed: number;
    swayAmplitude: number;
    swayFrequency: number;
    phase: number;
    tint: Color;
};

type BackgroundFlow = {
    x: number;
    y: number;
    length: number;
    width: number;
    alpha: number;
    speed: number;
    swayAmplitude: number;
    swayFrequency: number;
    phase: number;
};

/**
 * 场景构建器 - 纵向卷轴版
 * 
 * 在运行时动态创建整个游戏场景：
 * - 竖屏 720x1280
 * - 障碍物从下向上移动
 * - 左墙N极（红色），右墙S极（蓝色）
 * - 带磁极障碍物用红/蓝色表示
 * - 磁场反转区域用紫色表示
 * - 玩家在屏幕中上方，左右移动
 */
@ccclass('SceneBuilder')
export class SceneBuilder extends Component {
    private static readonly CLOUD_SPEED_REFERENCE = 300;
    private static readonly STAR_COUNT = 28;
    private static readonly MIST_COUNT = 3;
    private static readonly FLOW_COUNT = 18;

    private static readonly BACKGROUND_PATH = 'Art/UI/BattleBG1/spriteFrame';
    private static readonly CLOUD_CONFIGS = [
        { name: 'CloudN1', path: 'Art/UI/CloudN1_resized/spriteFrame', width: 176, startX: -165, startY: -500, speed: 11, swayAmplitude: 12, swayFrequency: 0.28, opacity: 205, scale: 0.96 },
        { name: 'CloudN2', path: 'Art/UI/CloudN2_resized/spriteFrame', width: 330, startX: 165, startY: -140, speed: 15, swayAmplitude: 18, swayFrequency: 0.2, opacity: 170, scale: 1 },
        { name: 'CloudS1', path: 'Art/UI/CloudS1_resized/spriteFrame', width: 192, startX: 148, startY: 250, speed: 18, swayAmplitude: 15, swayFrequency: 0.24, opacity: 220, scale: 0.92 },
        { name: 'CloudS2', path: 'Art/UI/CloudS2_resized/spriteFrame', width: 344, startX: -152, startY: 560, speed: 13, swayAmplitude: 14, swayFrequency: 0.18, opacity: 176, scale: 1.02 },
    ] as const;

    private readonly DESIGN_HEIGHT = 1280;
    private readonly DESIGN_WIDTH = 720;

    /** 场景边界（可活动区域，不含墙） */
    private readonly LEFT_BOUND = -310;  // 左墙内侧
    private readonly RIGHT_BOUND = 310;  // 右墙内侧

    /** 墙壁宽度 */
    private readonly WALL_WIDTH = 46;

    /** 玩家Y位置 */
    private readonly PLAYER_Y = 200;

    private _built: boolean = false;

    /** 玩家预制体（从resources加载） */
    private _playerPrefab: Prefab | null = null;

    private _cloudDriftStates: CloudDriftState[] = [];
    private _cloudElapsed: number = 0;
    private _cloudSpeedScale: number = 1;
    private _starStates: BackgroundStar[] = [];
    private _mistStates: BackgroundMist[] = [];
    private _flowStates: BackgroundFlow[] = [];
    private _starGraphics: Graphics | null = null;
    private _mistGraphics: Graphics | null = null;
    private _flowGraphics: Graphics | null = null;

    // 引用
    private _player: Player | null = null;
    private _obstacleSpawner: ObstacleSpawner | null = null;
    private _magneticField: MagneticField | null = null;
    private _uiManager: UIManager | null = null;
    private _magneticZoneManager: MagneticZoneManager | null = null;

    start() {
        if (!this._built) {
            resources.load('Prefabs/Actor/DefaultPlayer/Player', Prefab, (err, prefab) => {
                if (err) {
                    console.warn('加载玩家预制体失败，使用代码创建:', err);
                } else {
                    this._playerPrefab = prefab;
                }

                this.buildScene();
                this._built = true;
            });
        }
    }

    update(dt: number) {
        if (this._cloudDriftStates.length === 0 && !this._starGraphics && !this._mistGraphics && !this._flowGraphics) {
            return;
        }

        this._cloudElapsed += dt;

        const wrapTop = this.DESIGN_HEIGHT / 2 + 150;
        const wrapBottom = -this.DESIGN_HEIGHT / 2 - 150;

        this._cloudDriftStates = this._cloudDriftStates.filter((cloudState) => cloudState.node.isValid);

        for (const cloudState of this._cloudDriftStates) {
            const currentPosition = cloudState.node.position;
            const cloudSpeed = cloudState.baseSpeed * this._cloudSpeedScale;
            let nextY = currentPosition.y + cloudSpeed * dt;

            if (nextY > wrapTop) {
                nextY = wrapBottom;
            }

            const nextX = cloudState.baseX + Math.sin(this._cloudElapsed * cloudState.swayFrequency + cloudState.phase) * cloudState.swayAmplitude;
            cloudState.node.setPosition(nextX, nextY, currentPosition.z);
        }

        this.updateAtmosphereLayers(dt);
    }

    private buildScene() {
        const ownCanvas = this.node.getComponent(Canvas);
        const parentCanvas = this.node.parent?.getComponent(Canvas) || null;

        // 若已经挂在场景 Canvas 下，则直接复用父级坐标系，避免再创建一个偏移到左下角的 Canvas。
        if (!ownCanvas && !parentCanvas) {
            const canvas = this.node.addComponent(Canvas);
            canvas.alignCanvasWithScreen = true;
        }

        const uiTransform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        uiTransform.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        this.createBackgroundLayer();
        this.createMagneticFieldLayer();
        this.createMagneticZoneLayer();
        this.createGameLayer();
        this.createObstacleLayer();
        this.createUILayer();
    }

    private createBackgroundLayer() {
        const backgroundLayer = this.createNode('BackgroundLayer', this.node);
        backgroundLayer.addComponent(UITransform).setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        const backgroundNode = this.createSpriteNode('BattleBG', backgroundLayer, this.DESIGN_WIDTH, this.DESIGN_HEIGHT);
        this.loadSpriteFrame(backgroundNode.getComponent(Sprite)!, SceneBuilder.BACKGROUND_PATH);

        this.createAtmosphereLayers(backgroundLayer);

        const cloudLayer = this.createNode('CloudLayer', backgroundLayer);
        cloudLayer.addComponent(UITransform).setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        this._cloudDriftStates = [];

        SceneBuilder.CLOUD_CONFIGS.forEach((config, index) => {
            const cloudNode = this.createSpriteNode(config.name, cloudLayer, config.width, 120);
            cloudNode.setPosition(config.startX, config.startY, 0);

            const opacity = cloudNode.addComponent(UIOpacity);
            opacity.opacity = config.opacity;

            const sprite = cloudNode.getComponent(Sprite)!;
            sprite.sizeMode = Sprite.SizeMode.TRIMMED;
            this.loadSpriteFrame(sprite, config.path, (spriteFrame) => {
                const trimmedSize = spriteFrame.rect;
                const uiTransform = cloudNode.getComponent(UITransform);
                if (!uiTransform || trimmedSize.width <= 0 || trimmedSize.height <= 0) {
                    return;
                }

                const scale = Math.min(1, (config.width / trimmedSize.width) * config.scale);
                cloudNode.setScale(scale, scale, 1);
            });

            this._cloudDriftStates.push({
                node: cloudNode,
                baseX: config.startX,
                baseSpeed: config.speed,
                swayAmplitude: config.swayAmplitude,
                swayFrequency: config.swayFrequency,
                phase: index * 1.13,
            });
        });
    }

    private createAtmosphereLayers(backgroundLayer: Node) {
        const starNode = this.createGraphicsNode('StarLayer', backgroundLayer);
        const mistNode = this.createGraphicsNode('MistLayer', backgroundLayer);
        const flowNode = this.createGraphicsNode('FlowLayer', backgroundLayer);

        this._starGraphics = starNode.getComponent(Graphics);
        this._mistGraphics = mistNode.getComponent(Graphics);
        this._flowGraphics = flowNode.getComponent(Graphics);

        this._starStates = this.createStarStates();
        this._mistStates = this.createMistStates();
        this._flowStates = this.createFlowStates();

        this.drawStarLayer();
        this.drawMistLayer();
        this.drawFlowLayer();
    }

    private createStarStates(): BackgroundStar[] {
        const halfWidth = this.DESIGN_WIDTH / 2;
        const halfHeight = this.DESIGN_HEIGHT / 2;

        return Array.from({ length: SceneBuilder.STAR_COUNT }, () => ({
            x: this.randomRange(-halfWidth + 24, halfWidth - 24),
            y: this.randomRange(-halfHeight, halfHeight),
            radius: this.randomRange(1.2, 3.4),
            alpha: this.randomRange(0.18, 0.5),
            twinkle: this.randomRange(0.6, 1.2),
            phase: this.randomRange(0, Math.PI * 2),
            speed: this.randomRange(5, 16),
        }));
    }

    private createMistStates(): BackgroundMist[] {
        const halfWidth = this.DESIGN_WIDTH / 2;
        const halfHeight = this.DESIGN_HEIGHT / 2;
        const tints = [
            new Color(162, 205, 255, 24),
            new Color(194, 175, 255, 20),
            new Color(150, 240, 255, 18),
        ];

        return Array.from({ length: SceneBuilder.MIST_COUNT }, (_, index) => ({
            x: this.randomRange(-halfWidth * 0.28, halfWidth * 0.28),
            y: this.randomRange(-halfHeight, halfHeight),
            width: this.randomRange(420, 610),
            height: this.randomRange(120, 180),
            alpha: this.randomRange(0.18, 0.3),
            speed: this.randomRange(10, 20),
            swayAmplitude: this.randomRange(18, 34),
            swayFrequency: this.randomRange(0.12, 0.2),
            phase: index * 1.6,
            tint: tints[index % tints.length],
        }));
    }

    private createFlowStates(): BackgroundFlow[] {
        const halfWidth = this.DESIGN_WIDTH / 2;
        const halfHeight = this.DESIGN_HEIGHT / 2;

        return Array.from({ length: SceneBuilder.FLOW_COUNT }, () => ({
            x: this.randomRange(-halfWidth + 20, halfWidth - 20),
            y: this.randomRange(-halfHeight, halfHeight),
            length: this.randomRange(18, 44),
            width: this.randomRange(1, 2.2),
            alpha: this.randomRange(0.08, 0.2),
            speed: this.randomRange(48, 92),
            swayAmplitude: this.randomRange(6, 18),
            swayFrequency: this.randomRange(0.35, 0.65),
            phase: this.randomRange(0, Math.PI * 2),
        }));
    }

    private updateAtmosphereLayers(dt: number) {
        const halfHeight = this.DESIGN_HEIGHT / 2;
        const wrapPadding = 100;
        const speedScale = 0.55 + this._cloudSpeedScale * 0.45;

        for (const star of this._starStates) {
            star.y += star.speed * speedScale * dt;
            if (star.y > halfHeight + wrapPadding) {
                star.y = -halfHeight - wrapPadding;
            }
        }

        for (const mist of this._mistStates) {
            mist.y += mist.speed * speedScale * dt;
            if (mist.y > halfHeight + 180) {
                mist.y = -halfHeight - 180;
            }
        }

        for (const flow of this._flowStates) {
            flow.y += flow.speed * (0.6 + this._cloudSpeedScale * 0.85) * dt;
            if (flow.y > halfHeight + 120) {
                flow.y = -halfHeight - 120;
            }
        }

        this.drawStarLayer();
        this.drawMistLayer();
        this.drawFlowLayer();
    }

    private drawStarLayer() {
        if (!this._starGraphics) {
            return;
        }

        const gfx = this._starGraphics;
        gfx.clear();

        for (const star of this._starStates) {
            const twinkle = 0.72 + Math.sin(this._cloudElapsed * star.twinkle + star.phase) * 0.28;
            const outerAlpha = Math.min(255, Math.floor(255 * star.alpha * 0.34 * twinkle));
            const innerAlpha = Math.min(255, Math.floor(255 * star.alpha * twinkle));

            gfx.fillColor = new Color(180, 228, 255, outerAlpha);
            gfx.circle(star.x, star.y, star.radius * 2.2);
            gfx.fill();

            gfx.fillColor = new Color(255, 246, 235, innerAlpha);
            gfx.circle(star.x, star.y, star.radius);
            gfx.fill();
        }
    }

    private drawMistLayer() {
        if (!this._mistGraphics) {
            return;
        }

        const gfx = this._mistGraphics;
        gfx.clear();

        for (const mist of this._mistStates) {
            const x = mist.x + Math.sin(this._cloudElapsed * mist.swayFrequency + mist.phase) * mist.swayAmplitude;
            const alpha = Math.min(255, Math.floor(255 * mist.alpha));
            const innerAlpha = Math.min(255, Math.floor(alpha * 0.65));
            const y = mist.y;

            gfx.fillColor = new Color(mist.tint.r, mist.tint.g, mist.tint.b, alpha);
            gfx.roundRect(x - mist.width / 2, y - mist.height / 2, mist.width, mist.height, mist.height / 2);
            gfx.fill();

            gfx.fillColor = new Color(230, 240, 255, innerAlpha);
            gfx.roundRect(x - mist.width * 0.36, y - mist.height * 0.2, mist.width * 0.72, mist.height * 0.4, mist.height * 0.2);
            gfx.fill();
        }
    }

    private drawFlowLayer() {
        if (!this._flowGraphics) {
            return;
        }

        const gfx = this._flowGraphics;
        gfx.clear();

        for (const flow of this._flowStates) {
            const x = flow.x + Math.sin(this._cloudElapsed * flow.swayFrequency + flow.phase) * flow.swayAmplitude;
            const alpha = Math.min(255, Math.floor(255 * flow.alpha));

            gfx.strokeColor = new Color(208, 245, 255, alpha);
            gfx.lineWidth = flow.width;
            gfx.moveTo(x, flow.y - flow.length * 0.5);
            gfx.lineTo(x, flow.y + flow.length * 0.5);
            gfx.stroke();

            gfx.fillColor = new Color(255, 255, 255, Math.min(255, Math.floor(alpha * 0.7)));
            gfx.circle(x, flow.y + flow.length * 0.5, flow.width * 0.7);
            gfx.fill();
        }
    }

    /**
     * 磁场层 - 逻辑组件
     */
    private createMagneticFieldLayer() {
        const fieldLayer = this.createNode('MagneticFieldLayer', this.node);
        const uiTransform = fieldLayer.addComponent(UITransform);
        uiTransform.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        // 磁场逻辑组件
        const magneticField = fieldLayer.addComponent(MagneticField);
        magneticField.init(0);

        this._magneticField = magneticField;
    }

    /**
     * 磁场区域层 - 反转区域视觉
     */
    private createMagneticZoneLayer() {
        const zoneLayer = this.createNode('MagneticZoneLayer', this.node);
        const uiTransform = zoneLayer.addComponent(UITransform);
        uiTransform.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        // 磁场区域管理器组件
        const zoneManager = zoneLayer.addComponent(MagneticZoneManager);
        zoneManager.setPlayerY(this.PLAYER_Y);
        zoneManager.setPlayWidth(this.RIGHT_BOUND - this.LEFT_BOUND);

        this._magneticZoneManager = zoneManager;
    }

    /**
     * 游戏层 - 玩家
     */
    private createGameLayer() {
        const gameLayer = this.createNode('GameLayer', this.node);
        const uiTransform = gameLayer.addComponent(UITransform);
        uiTransform.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        if (this._playerPrefab) {
            // 使用预制体创建玩家
            const playerNode = instantiate(this._playerPrefab);
            playerNode.setParent(gameLayer);
            playerNode.setPosition(0, this.PLAYER_Y, 0);

            playerNode.setScale(1, 1, 1);

            // 确保有UITransform
            let playerUT = playerNode.getComponent(UITransform);
            if (!playerUT) {
                playerUT = playerNode.addComponent(UITransform);
            }
            playerUT.setContentSize(new Size(50, 50));

            // 添加Graphics子节点（用于磁力特效绘制），放在最底层（index 0）
            const playerGfx = this.createNode('PlayerGfx', playerNode);
            playerGfx.addComponent(UITransform).setContentSize(new Size(50, 50));
            playerGfx.addComponent(Graphics);
            playerNode.insertChild(playerGfx, 0);

            // Player组件 — 碰撞半径缩小，拾取半径放大
            const player = playerNode.addComponent(Player);
            player.setBounds(this.LEFT_BOUND, this.RIGHT_BOUND);
            player.setRadius(25);
            player.setCollectRadius(80);
            player.onPoleChanged = (pole: MagneticPole) => {
                const spr = playerNode.getComponentInChildren(Sprite);
                if (spr) {
                    spr.color = pole === MagneticPole.N
                        ? new Color(255, 80, 80, 255)
                        : new Color(80, 80, 255, 255);
                }
            };

            this._player = player;
        } else {
            // 降级：代码创建玩家（无动画）
            this.createPlayerFromCode(gameLayer);
        }
    }

    /**
     * 降级方案：用代码创建玩家（无动画）
     */
    private createPlayerFromCode(gameLayer: Node) {
        const playerNode = this.createNode('Player', gameLayer);
        playerNode.setPosition(0, this.PLAYER_Y, 0);

        const playerUT = playerNode.addComponent(UITransform);
        playerUT.setContentSize(new Size(50, 50));

        // 玩家精灵
        const playerSprite = playerNode.addComponent(Sprite);
        playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        playerSprite.type = Sprite.Type.SIMPLE;
        playerSprite.color = new Color(255, 80, 80, 255);

        // 玩家外形 - Graphics绘制
        const playerGfx = this.createNode('PlayerGfx', playerNode);
        playerGfx.addComponent(UITransform).setContentSize(new Size(50, 50));
        playerGfx.addComponent(Graphics);

        // Player组件
        const player = playerNode.addComponent(Player);
        player.setBounds(this.LEFT_BOUND, this.RIGHT_BOUND);
        player.setRadius(22);
        player.onPoleChanged = (pole: MagneticPole) => {
            const spr = playerNode.getComponent(Sprite);
            if (spr) {
                spr.color = pole === MagneticPole.N
                    ? new Color(255, 80, 80, 255)
                    : new Color(80, 80, 255, 255);
            }
        };

        this._player = player;
    }

    /**
     * 障碍物层
     */
    private createObstacleLayer() {
        const obstacleLayer = this.createNode('ObstacleLayer', this.node);
        const uiTransform = obstacleLayer.addComponent(UITransform);
        uiTransform.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        // 生成器
        const spawner = obstacleLayer.addComponent(ObstacleSpawner);
        spawner.screenWidth = this.DESIGN_WIDTH;
        spawner.playerLineY = this.PLAYER_Y;
        spawner.wallWidth = this.WALL_WIDTH;
        spawner.wallWidthRight = this.WALL_WIDTH;

        this._obstacleSpawner = spawner;
    }

    /**
     * UI层
     */
    private createUILayer() {
        const uiLayer = this.createNode('UILayer', this.node);
        const uiTransform = uiLayer.addComponent(UITransform);
        uiTransform.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        // 提示文本
        const tipNode = this.createNode('TipLabel', uiLayer);
        tipNode.setPosition(0, -this.DESIGN_HEIGHT / 2 + 60, 0);
        const tipLabel = tipNode.addComponent(Label);
        tipLabel.string = TextManager.getInstance().getText(TextId.TapToSwitch);
        tipLabel.fontSize = 24;
        tipLabel.lineHeight = 24;
        tipLabel.color = new Color(200, 200, 200, 150);
        tipLabel.overflow = Overflow.NONE;
        tipLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        // UIManager
        const uiManager = uiLayer.addComponent(UIManager);
        uiManager.startPanel = null;  // 无需开始面板，进入直接开始
        uiManager.gameOverPanel = null;
        uiManager.finalScoreLabel = null;
        uiManager.bestScoreLabel = null;

        this._uiManager = uiManager;
    }

    private createNode(name: string, parent: Node): Node {
        const node = new Node(name);
        node.setParent(parent);
        return node;
    }

    private createGraphicsNode(name: string, parent: Node): Node {
        const node = this.createNode(name, parent);
        node.addComponent(UITransform).setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));
        node.addComponent(Graphics);
        return node;
    }

    private createSpriteNode(name: string, parent: Node, width: number, height: number): Node {
        const node = this.createNode(name, parent);
        const uiTransform = node.addComponent(UITransform);
        uiTransform.setContentSize(new Size(width, height));

        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;

        return node;
    }

    private loadSpriteFrame(sprite: Sprite, path: string, onLoaded?: (spriteFrame: SpriteFrame) => void) {
        resources.load(path, SpriteFrame, (error, spriteFrame) => {
            if (error || !spriteFrame || !sprite.node.isValid) {
                if (error) {
                    console.warn(`[SceneBuilder] 加载资源失败: ${path}`, error);
                }
                return;
            }

            sprite.spriteFrame = spriteFrame;
            onLoaded?.(spriteFrame);
        });
    }

    public setCloudDriftReferenceSpeed(speed: number) {
        const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : SceneBuilder.CLOUD_SPEED_REFERENCE;
        this._cloudSpeedScale = SceneBuilder.CLOUD_SPEED_REFERENCE > 0
            ? safeSpeed / SceneBuilder.CLOUD_SPEED_REFERENCE
            : 1;
    }

    private randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    public getPlayer(): Player | null { return this._player; }
    public getObstacleSpawner(): ObstacleSpawner | null { return this._obstacleSpawner; }
    public getUIManager(): UIManager | null { return this._uiManager; }
    public getMagneticField(): MagneticField | null { return this._magneticField; }
    public getMagneticZoneManager(): MagneticZoneManager | null { return this._magneticZoneManager; }
}
