import { _decorator, Component, Node, UITransform, Size, Sprite, Label, Color, Button, Overflow, HorizontalTextAlignment, director, Canvas, Widget } from 'cc';
const { ccclass } = _decorator;

/**
 * 主界面UI - 在main场景中使用
 * 显示游戏标题、最高分、开始按钮
 */
@ccclass('MainUI')
export class MainUI extends Component {

    private readonly DESIGN_WIDTH = 720;
    private readonly DESIGN_HEIGHT = 1280;

    /** 最高分 */
    private _bestScore: number = 0;

    /** 最高分标签 */
    private _bestScoreLabel: Label | null = null;

    start() {
        this._bestScore = parseInt(localStorage.getItem('magneticJump_bestScore') || '0', 10);
        this.buildUI();
    }

    private buildUI() {
        const canvas = this.node.getComponent(Canvas);
        if (!canvas) {
            this.node.addComponent(Canvas);
            const uiTransform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
            uiTransform.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));
        }

        // 背景层
        this.createBackground();
        // 标题
        this.createTitle();
        // 最高分
        this.createBestScore();
        // 开始按钮
        this.createStartButton();
        // 操作说明
        this.createHowToPlay();
    }

    private createBackground() {
        const bgLayer = new Node('MainBG');
        bgLayer.setParent(this.node);
        const ut = bgLayer.addComponent(UITransform);
        ut.setContentSize(new Size(this.DESIGN_WIDTH, this.DESIGN_HEIGHT));
        const sprite = bgLayer.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.color = new Color(15, 15, 35, 255);

        // 装饰：左右磁极区域
        const northZone = new Node('NorthZone');
        northZone.setParent(bgLayer);
        const nUT = northZone.addComponent(UITransform);
        nUT.setContentSize(new Size(this.DESIGN_WIDTH / 2, this.DESIGN_HEIGHT));
        northZone.setPosition(-this.DESIGN_WIDTH / 4, 0, 0);
        const nSprite = northZone.addComponent(Sprite);
        nSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        nSprite.type = Sprite.Type.SIMPLE;
        nSprite.color = new Color(255, 40, 40, 20);

        const nLabelNode = new Node('NLabel');
        nLabelNode.setParent(northZone);
        nLabelNode.setPosition(0, -400, 0);
        const nLabel = nLabelNode.addComponent(Label);
        nLabel.string = 'N';
        nLabel.fontSize = 72;
        nLabel.lineHeight = 72;
        nLabel.color = new Color(255, 80, 80, 40);
        nLabel.overflow = Overflow.NONE;
        nLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        const southZone = new Node('SouthZone');
        southZone.setParent(bgLayer);
        const sUT = southZone.addComponent(UITransform);
        sUT.setContentSize(new Size(this.DESIGN_WIDTH / 2, this.DESIGN_HEIGHT));
        southZone.setPosition(this.DESIGN_WIDTH / 4, 0, 0);
        const sSprite = southZone.addComponent(Sprite);
        sSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sSprite.type = Sprite.Type.SIMPLE;
        sSprite.color = new Color(40, 40, 255, 20);

        const sLabelNode = new Node('SLabel');
        sLabelNode.setParent(southZone);
        sLabelNode.setPosition(0, -400, 0);
        const sLabel = sLabelNode.addComponent(Label);
        sLabel.string = 'S';
        sLabel.fontSize = 72;
        sLabel.lineHeight = 72;
        sLabel.color = new Color(80, 80, 255, 40);
        sLabel.overflow = Overflow.NONE;
        sLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    }

    private createTitle() {
        const titleNode = new Node('Title');
        titleNode.setParent(this.node);
        titleNode.setPosition(0, 280, 0);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '磁力跑酷';
        titleLabel.fontSize = 72;
        titleLabel.lineHeight = 72;
        titleLabel.color = new Color(255, 220, 100, 255);
        titleLabel.overflow = Overflow.NONE;
        titleLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        const subNode = new Node('Subtitle');
        subNode.setParent(this.node);
        subNode.setPosition(0, 200, 0);
        const subLabel = subNode.addComponent(Label);
        subLabel.string = 'Magnetic Runner';
        subLabel.fontSize = 30;
        subLabel.lineHeight = 30;
        subLabel.color = new Color(200, 200, 200, 200);
        subLabel.overflow = Overflow.NONE;
        subLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    }

    private createBestScore() {
        const bestTitleNode = new Node('BestTitle');
        bestTitleNode.setParent(this.node);
        bestTitleNode.setPosition(0, 100, 0);
        const bestTitleLabel = bestTitleNode.addComponent(Label);
        bestTitleLabel.string = '最高分';
        bestTitleLabel.fontSize = 24;
        bestTitleLabel.lineHeight = 24;
        bestTitleLabel.color = new Color(180, 180, 180, 180);
        bestTitleLabel.overflow = Overflow.NONE;
        bestTitleLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        const bestScoreNode = new Node('BestScore');
        bestScoreNode.setParent(this.node);
        bestScoreNode.setPosition(0, 60, 0);
        this._bestScoreLabel = bestScoreNode.addComponent(Label);
        this._bestScoreLabel.string = `${this._bestScore}`;
        this._bestScoreLabel.fontSize = 48;
        this._bestScoreLabel.lineHeight = 48;
        this._bestScoreLabel.color = new Color(255, 220, 100, 255);
        this._bestScoreLabel.overflow = Overflow.NONE;
        this._bestScoreLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    }

    private createStartButton() {
        const btnNode = new Node('StartButton');
        btnNode.setParent(this.node);
        btnNode.setPosition(0, -60, 0);
        const btnUT = btnNode.addComponent(UITransform);
        btnUT.setContentSize(new Size(280, 80));
        const btnSprite = btnNode.addComponent(Sprite);
        btnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        btnSprite.type = Sprite.Type.SIMPLE;
        btnSprite.color = new Color(100, 200, 100, 255);

        const btnLabelNode = new Node('BtnLabel');
        btnLabelNode.setParent(btnNode);
        const btnLabel = btnLabelNode.addComponent(Label);
        btnLabel.string = '开始游戏';
        btnLabel.fontSize = 36;
        btnLabel.lineHeight = 36;
        btnLabel.color = new Color(255, 255, 255, 255);
        btnLabel.overflow = Overflow.NONE;
        btnLabel.horizontalAlign = HorizontalTextAlignment.CENTER;

        const button = btnNode.addComponent(Button);
        button.transition = Button.Transition.COLOR;
        button.normalColor = new Color(100, 200, 100, 255);
        button.pressedColor = new Color(80, 160, 80, 255);
        button.hoverColor = new Color(120, 220, 120, 255);

        btnNode.on(Node.EventType.TOUCH_END, () => {
            this.onStartGame();
        });
    }

    private createHowToPlay() {
        const howToNode = new Node('HowToPlay');
        howToNode.setParent(this.node);
        howToNode.setPosition(0, -240, 0);
        const howToLabel = howToNode.addComponent(Label);
        howToLabel.string = '点击屏幕切换磁极\n左N右S 同性相斥 异性相吸\n小心红蓝磁极障碍物！\n紫色区域磁场反转！';
        howToLabel.fontSize = 22;
        howToLabel.lineHeight = 34;
        howToLabel.color = new Color(200, 200, 200, 160);
        howToLabel.overflow = Overflow.RESIZE_HEIGHT;
        howToLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    }

    private onStartGame() {
        director.loadScene('battle');
    }

    onEnable() {
        // 每次回到主界面时刷新最高分
        this._bestScore = parseInt(localStorage.getItem('magneticJump_bestScore') || '0', 10);
        if (this._bestScoreLabel) {
            this._bestScoreLabel.string = `${this._bestScore}`;
        }
    }
}
