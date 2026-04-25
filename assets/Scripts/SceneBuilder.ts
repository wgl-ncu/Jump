import { _decorator, Component, Node, UITransform, Size, Sprite, SpriteFrame, Color, Label, Graphics, Canvas, Button, Overflow, HorizontalTextAlignment, VerticalTextAlignment, resources, Prefab, instantiate } from 'cc';
import { Player, MagneticPole } from './Player';
import { ObstacleSpawner } from './ObstacleSpawner';
import { UIManager } from './UIManager';
import { MagneticField } from './MagneticField';
import { ScrollingBackground } from './ScrollingBackground';
import { MagneticZoneManager } from './MagneticZoneManager';
import { TextManager } from './Data/TextManager';
import { TextId } from './Data/TextId';
const { ccclass } = _decorator;

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

    private static readonly BATTLE_BG_PATH = 'Art/Map/BattleBG/spriteFrame';

    private readonly DESIGN_HEIGHT = 1280;
    private readonly DESIGN_WIDTH = 720;

    /** 场景边界（可活动区域，不含墙） */
    private readonly LEFT_BOUND = -310;  // 左墙内侧
    private readonly RIGHT_BOUND = 310;  // 右墙内侧

    /** 墙壁宽度 */
    private readonly WALL_WIDTH = 40;

    /** 玩家Y位置 */
    private readonly PLAYER_Y = 200;

    private _built: boolean = false;

    /** 玩家预制体（从resources加载） */
    private _playerPrefab: Prefab | null = null;

    // 引用
    private _player: Player | null = null;
    private _obstacleSpawner: ObstacleSpawner | null = null;
    private _magneticField: MagneticField | null = null;
    private _uiManager: UIManager | null = null;
    private _scrollingBg: ScrollingBackground | null = null;
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

    /**
     * 背景层 - 深色背景 + 向上滚动的网格线
     */
    private createBackgroundLayer() {
        const bgLayer = this.createNode('BackgroundLayer', this.node);
        const uiTransform = bgLayer.addComponent(UITransform);
        uiTransform.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));

        // 默认深色背景；BattleBG 加载成功后会替换为底图。
        const bgSprite = bgLayer.addComponent(Sprite);
        bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSprite.type = Sprite.Type.SIMPLE;
        bgSprite.color = new Color(15, 15, 30, 255);

        resources.load(SceneBuilder.BATTLE_BG_PATH, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.warn('加载 BattleBG 失败，继续使用纯色背景:', err);
                return;
            }

            if (!bgSprite.isValid) {
                return;
            }

            bgSprite.spriteFrame = spriteFrame;
            bgSprite.color = Color.WHITE;
        });

        // 滚动背景（向上滚动的线条效果）
        this._scrollingBg = bgLayer.addComponent(ScrollingBackground);
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

        // 分数显示（顶部中央）
        const scoreNode = this.createNode('ScoreLabel', uiLayer);
        scoreNode.setPosition(0, this.DESIGN_HEIGHT / 2 - 80, 0);
        const scoreLabel = scoreNode.addComponent(Label);
        scoreLabel.string = '0';
        scoreLabel.fontSize = 48;
        scoreLabel.lineHeight = 48;
        scoreLabel.color = new Color(255, 255, 255, 255);
        scoreLabel.overflow = Overflow.NONE;
        scoreLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
        scoreNode.getComponent(UITransform)!.setContentSize(new Size(200, 60));

        // 磁极指示器（左上角）
        const poleNode = this.createNode('PoleIndicator', uiLayer);
        poleNode.setPosition(-280, this.DESIGN_HEIGHT / 2 - 80, 0);
        const poleIndicator = poleNode.addComponent(Label);
        poleIndicator.string = 'N';
        poleIndicator.fontSize = 36;
        poleIndicator.lineHeight = 36;
        poleIndicator.color = new Color(255, 80, 80, 255);
        poleIndicator.overflow = Overflow.NONE;
        poleIndicator.horizontalAlign = HorizontalTextAlignment.CENTER;
        poleNode.getComponent(UITransform)!.setContentSize(new Size(60, 50));

        // 磁场状态指示器（左上角，磁极指示下方）
        const fieldStatusNode = this.createNode('FieldStatus', uiLayer);
        fieldStatusNode.setPosition(-280, this.DESIGN_HEIGHT / 2 - 120, 0);
        const fieldStatusLabel = fieldStatusNode.addComponent(Label);
        fieldStatusLabel.string = '';
        fieldStatusLabel.fontSize = 18;
        fieldStatusLabel.lineHeight = 18;
        fieldStatusLabel.color = new Color(180, 80, 255, 0);
        fieldStatusLabel.overflow = Overflow.NONE;
        fieldStatusLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
        fieldStatusNode.getComponent(UITransform)!.setContentSize(new Size(120, 30));

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

        // === 游戏结束面板 ===
        const gameOverPanel = this.createNode('GameOverPanel', uiLayer);
        gameOverPanel.active = false;
        const gopUT = gameOverPanel.addComponent(UITransform);
        gopUT.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));
        const gopSprite = gameOverPanel.addComponent(Sprite);
        gopSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        gopSprite.type = Sprite.Type.SIMPLE;
        gopSprite.color = new Color(0, 0, 0, 180);

        // 游戏结束标题
        const goTitle = this.createNode('GOTitle', gameOverPanel);
        goTitle.setPosition(0, 160, 0);
        const goTitleLabel = goTitle.addComponent(Label);
        goTitleLabel.string = TextManager.getInstance().getText(TextId.GameOver);
        goTitleLabel.fontSize = 56;
        goTitleLabel.lineHeight = 56;
        goTitleLabel.color = new Color(255, 100, 100, 255);
        goTitleLabel.overflow = Overflow.NONE;
        goTitleLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        // 最终分数
        const finalNode = this.createNode('FinalScore', gameOverPanel);
        finalNode.setPosition(0, 60, 0);
        const finalLabel = finalNode.addComponent(Label);
        finalLabel.string = '0';
        finalLabel.fontSize = 48;
        finalLabel.lineHeight = 48;
        finalLabel.color = new Color(255, 255, 255, 255);
        finalLabel.overflow = Overflow.NONE;
        finalLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        // 最高分标签
        const bestTextNode = this.createNode('BestLabel', gameOverPanel);
        bestTextNode.setPosition(0, 10, 0);
        const bestTextLabel = bestTextNode.addComponent(Label);
        bestTextLabel.string = TextManager.getInstance().getText(TextId.HighScore);
        bestTextLabel.fontSize = 20;
        bestTextLabel.lineHeight = 20;
        bestTextLabel.color = new Color(200, 200, 200, 180);
        bestTextLabel.overflow = Overflow.NONE;
        bestTextLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        // 最高分
        const bestNode = this.createNode('BestScore', gameOverPanel);
        bestNode.setPosition(0, -20, 0);
        const bestLabel = bestNode.addComponent(Label);
        bestLabel.string = '0';
        bestLabel.fontSize = 28;
        bestLabel.lineHeight = 28;
        bestLabel.color = new Color(255, 220, 100, 255);
        bestLabel.overflow = Overflow.NONE;
        bestLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        // 重新开始按钮
        const restartBtn = this.createNode('RestartButton', gameOverPanel);
        restartBtn.setPosition(0, -110, 0);
        const rBtnUT = restartBtn.addComponent(UITransform);
        rBtnUT.setContentSize(new Size(240, 60));
        const rBtnSprite = restartBtn.addComponent(Sprite);
        rBtnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        rBtnSprite.type = Sprite.Type.SIMPLE;
        rBtnSprite.color = new Color(100, 200, 100, 255);
        const rBtnLabelNode = this.createNode('BtnLabel', restartBtn);
        const rBtnLabel = rBtnLabelNode.addComponent(Label);
        rBtnLabel.string = TextManager.getInstance().getText(TextId.TryAgain);
        rBtnLabel.fontSize = 28;
        rBtnLabel.lineHeight = 28;
        rBtnLabel.color = new Color(255, 255, 255, 255);
        rBtnLabel.overflow = Overflow.NONE;
        rBtnLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
        const rButton = restartBtn.addComponent(Button);
        rButton.transition = Button.Transition.COLOR;
        rButton.normalColor = new Color(100, 200, 100, 255);
        rButton.pressedColor = new Color(80, 160, 80, 255);
        rButton.hoverColor = new Color(120, 220, 120, 255);

        // 返回主页按钮
        const backBtn = this.createNode('BackButton', gameOverPanel);
        backBtn.setPosition(0, -190, 0);
        const bBtnUT = backBtn.addComponent(UITransform);
        bBtnUT.setContentSize(new Size(240, 60));
        const bBtnSprite = backBtn.addComponent(Sprite);
        bBtnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        bBtnSprite.type = Sprite.Type.SIMPLE;
        bBtnSprite.color = new Color(80, 120, 200, 255);
        const bBtnLabelNode = this.createNode('BtnLabel', backBtn);
        const bBtnLabel = bBtnLabelNode.addComponent(Label);
        bBtnLabel.string = TextManager.getInstance().getText(TextId.BackToHome);
        bBtnLabel.fontSize = 28;
        bBtnLabel.lineHeight = 28;
        bBtnLabel.color = new Color(255, 255, 255, 255);
        bBtnLabel.overflow = Overflow.NONE;
        bBtnLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
        const bButton = backBtn.addComponent(Button);
        bButton.transition = Button.Transition.COLOR;
        bButton.normalColor = new Color(80, 120, 200, 255);
        bButton.pressedColor = new Color(60, 90, 160, 255);
        bButton.hoverColor = new Color(100, 140, 220, 255);

        // UIManager
        const uiManager = uiLayer.addComponent(UIManager);
        uiManager.scoreLabel = scoreLabel;
        uiManager.poleLabel = poleIndicator;
        uiManager.startPanel = null;  // 无需开始面板，进入直接开始
        uiManager.gameOverPanel = gameOverPanel;
        uiManager.finalScoreLabel = finalLabel;
        uiManager.bestScoreLabel = bestLabel;

        // 按钮点击事件
        restartBtn.on(Node.EventType.TOUCH_END, () => {
            uiManager.onRestartButtonClicked();
        });
        backBtn.on(Node.EventType.TOUCH_END, () => {
            uiManager.onBackToMainButtonClicked();
        });

        this._uiManager = uiManager;
    }

    private createNode(name: string, parent: Node): Node {
        const node = new Node(name);
        node.setParent(parent);
        return node;
    }

    public getPlayer(): Player | null { return this._player; }
    public getObstacleSpawner(): ObstacleSpawner | null { return this._obstacleSpawner; }
    public getUIManager(): UIManager | null { return this._uiManager; }
    public getMagneticField(): MagneticField | null { return this._magneticField; }
    public getScrollingBackground(): ScrollingBackground | null { return this._scrollingBg; }
    public getMagneticZoneManager(): MagneticZoneManager | null { return this._magneticZoneManager; }
}
