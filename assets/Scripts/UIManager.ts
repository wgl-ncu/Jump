import { _decorator, Component, Node, Label, Color, UITransform, Size, Overflow, HorizontalTextAlignment } from 'cc';
import { MagneticPole } from './Player';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {

    @property({ tooltip: '分数标签' })
    public scoreLabel: Label | null = null;

    @property({ tooltip: '磁极指示标签' })
    public poleLabel: Label | null = null;

    @property({ tooltip: '游戏开始界面' })
    public startPanel: Node | null = null;

    @property({ tooltip: '游戏结束界面' })
    public gameOverPanel: Node | null = null;

    @property({ tooltip: '最终分数标签' })
    public finalScoreLabel: Label | null = null;

    @property({ tooltip: '最高分标签' })
    public bestScoreLabel: Label | null = null;

    /** 当前分数 */
    private _score: number = 0;

    /** 最高分 */
    private _bestScore: number = 0;

    /** 开始按钮回调 */
    public onStartClicked: (() => void) | null = null;

    /** 重新开始按钮回调 */
    public onRestartClicked: (() => void) | null = null;

    /** 返回主页按钮回调 */
    public onBackToMainClicked: (() => void) | null = null;

    /** 磁场状态标签 */
    private _fieldStatusLabel: Label | null = null;

    /** 生命值标签 */
    private _livesLabel: Label | null = null;

    /** 无敌状态标签 */
    private _invincibleLabel: Label | null = null;

    /** 无敌剩余时间 */
    private _invincibleTimeLeft: number = 0;

    /** 是否显示无敌倒计时 */
    private _showInvincible: boolean = false;

    /** 冲刺状态标签 */
    private _dashLabel: Label | null = null;

    /** 冲刺剩余时间 */
    private _dashTimeLeft: number = 0;

    /** 是否显示冲刺倒计时 */
    private _showDash: boolean = false;

    /** ========= 奖励房间UI ========= */

    /** 奖励房间倒计时标签 */
    private _bonusRoomLabel: Label | null = null;

    /** 奖励房间剩余时间 */
    private _bonusRoomTimeLeft: number = 0;

    /** 是否显示奖励房间倒计时 */
    private _showBonusRoom: boolean = false;

    start() {
        this._bestScore = parseInt(localStorage.getItem('magneticJump_bestScore') || '0', 10);
        // 不再显示开始面板，进入battle直接开始游戏
        this.hideAllPanels();
        this.createFieldStatusIndicator();
        this.createLivesIndicator();
        this.createInvincibleIndicator();
        this.createDashIndicator();
        this.createBonusRoomIndicator();
    }

    /**
     * 创建磁场状态指示器
     */
    private createFieldStatusIndicator() {
        // 在磁极指示下方创建磁场状态标签
        const uiLayer = this.node;
        if (!uiLayer) return;

        const statusNode = new Node('FieldStatus');
        statusNode.setParent(uiLayer);
        statusNode.setPosition(-280, 530, 0);  // 在磁极指示下方

        const ut = statusNode.addComponent(UITransform);
        ut.setContentSize(new Size(120, 30));

        this._fieldStatusLabel = statusNode.addComponent(Label);
        this._fieldStatusLabel.string = '';
        this._fieldStatusLabel.fontSize = 18;
        this._fieldStatusLabel.lineHeight = 18;
        this._fieldStatusLabel.color = new Color(180, 80, 255, 0);  // 初始透明
        this._fieldStatusLabel.overflow = Overflow.NONE;
        this._fieldStatusLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    }

    /**
     * 更新磁场反转状态显示
     */
    public updateFieldStatus(reversalFactor: number) {

        if (this._fieldStatusLabel) {
            if (reversalFactor > 0.5) {
                this._fieldStatusLabel.string = '⚡磁场反转';
                this._fieldStatusLabel.color = new Color(200, 80, 255, Math.floor(255 * reversalFactor));
            } else if (reversalFactor > 0.05) {
                this._fieldStatusLabel.string = '磁场切换中';
                this._fieldStatusLabel.color = new Color(180, 120, 220, Math.floor(180 * reversalFactor));
            } else {
                this._fieldStatusLabel.string = '';
                this._fieldStatusLabel.color = new Color(180, 80, 255, 0);
            }
        }
    }

    /**
     * 创建生命值指示器
     */
    private createLivesIndicator() {
        const uiLayer = this.node;
        if (!uiLayer) return;

        const livesNode = new Node('LivesIndicator');
        livesNode.setParent(uiLayer);
        livesNode.setPosition(250, 550, 0);

        const ut = livesNode.addComponent(UITransform);
        ut.setContentSize(new Size(120, 30));

        this._livesLabel = livesNode.addComponent(Label);
        this._livesLabel.string = '♥♥♥';
        this._livesLabel.fontSize = 24;
        this._livesLabel.lineHeight = 24;
        this._livesLabel.color = new Color(255, 80, 80, 255);
        this._livesLabel.overflow = Overflow.NONE;
        this._livesLabel.horizontalAlign = HorizontalTextAlignment.RIGHT;
    }

    /**
     * 更新生命值显示
     */
    public updateLives(lives: number) {
        if (!this._livesLabel) return;
        this._livesLabel.string = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
        // 受伤时变红闪烁
        this._livesLabel.color = lives < 3
            ? new Color(255, 80, 80, 255)
            : new Color(255, 120, 120, 255);
    }

    /**
     * 创建无敌状态指示器
     */
    private createInvincibleIndicator() {
        const uiLayer = this.node;
        if (!uiLayer) return;

        const invNode = new Node('InvincibleIndicator');
        invNode.setParent(uiLayer);
        invNode.setPosition(0, 490, 0);

        const ut = invNode.addComponent(UITransform);
        ut.setContentSize(new Size(200, 30));

        this._invincibleLabel = invNode.addComponent(Label);
        this._invincibleLabel.string = '';
        this._invincibleLabel.fontSize = 22;
        this._invincibleLabel.lineHeight = 22;
        this._invincibleLabel.color = new Color(100, 220, 255, 255);
        this._invincibleLabel.overflow = Overflow.NONE;
        this._invincibleLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    }

    /**
     * 创建冲刺状态指示器
     */
    private createDashIndicator() {
        const uiLayer = this.node;
        if (!uiLayer) return;

        const dashNode = new Node('DashIndicator');
        dashNode.setParent(uiLayer);
        dashNode.setPosition(0, 460, 0);

        const ut = dashNode.addComponent(UITransform);
        ut.setContentSize(new Size(200, 30));

        this._dashLabel = dashNode.addComponent(Label);
        this._dashLabel.string = '';
        this._dashLabel.fontSize = 22;
        this._dashLabel.lineHeight = 22;
        this._dashLabel.color = new Color(255, 180, 50, 255);
        this._dashLabel.overflow = Overflow.NONE;
        this._dashLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    }

    /**
     * 创建奖励房间倒计时指示器
     */
    private createBonusRoomIndicator() {
        const uiLayer = this.node;
        if (!uiLayer) return;

        const bonusNode = new Node('BonusRoomIndicator');
        bonusNode.setParent(uiLayer);
        bonusNode.setPosition(0, 430, 0);

        const ut = bonusNode.addComponent(UITransform);
        ut.setContentSize(new Size(300, 40));

        this._bonusRoomLabel = bonusNode.addComponent(Label);
        this._bonusRoomLabel.string = '';
        this._bonusRoomLabel.fontSize = 28;
        this._bonusRoomLabel.lineHeight = 28;
        this._bonusRoomLabel.color = new Color(255, 200, 50, 255);
        this._bonusRoomLabel.overflow = Overflow.NONE;
        this._bonusRoomLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    }

    /**
     * 显示/隐藏无敌倒计时
     */
    public updateInvincibleStatus(active: boolean, timeLeft: number = 0) {
        this._showInvincible = active;
        this._invincibleTimeLeft = timeLeft;
        if (this._invincibleLabel) {
            if (active && timeLeft > 0) {
                const seconds = Math.ceil(timeLeft);
                this._invincibleLabel.string = `🛡 无敌 ${seconds}s`;
                // 快结束时闪烁
                if (timeLeft <= 3) {
                    const flash = Math.floor(timeLeft * 4) % 2 === 0;
                    this._invincibleLabel.color = flash
                        ? new Color(255, 80, 80, 255)
                        : new Color(100, 220, 255, 255);
                } else {
                    this._invincibleLabel.color = new Color(100, 220, 255, 255);
                }
            } else {
                this._invincibleLabel.string = '';
            }
        }
    }

    /**
     * 显示/隐藏冲刺倒计时
     */
    public updateDashStatus(active: boolean, timeLeft: number = 0) {
        this._showDash = active;
        this._dashTimeLeft = timeLeft;
        if (this._dashLabel) {
            if (active && timeLeft > 0) {
                const seconds = Math.ceil(timeLeft);
                this._dashLabel.string = `⚡ 冲刺 ${seconds}s`;
                // 快结束时闪烁
                if (timeLeft <= 2) {
                    const flash = Math.floor(timeLeft * 4) % 2 === 0;
                    this._dashLabel.color = flash
                        ? new Color(255, 80, 80, 255)
                        : new Color(255, 180, 50, 255);
                } else {
                    this._dashLabel.color = new Color(255, 180, 50, 255);
                }
            } else {
                this._dashLabel.string = '';
            }
        }
    }

    /**
     * 显示/隐藏奖励房间倒计时
     */
    public updateBonusRoomStatus(active: boolean, timeLeft: number = 0) {
        this._showBonusRoom = active;
        this._bonusRoomTimeLeft = timeLeft;
        if (this._bonusRoomLabel) {
            if (active && timeLeft > 0) {
                const seconds = Math.ceil(timeLeft);
                this._bonusRoomLabel.string = `✨ 神秘奖励 ${seconds}s ✨`;
                // 快结束时闪烁
                if (timeLeft <= 3) {
                    const flash = Math.floor(timeLeft * 4) % 2 === 0;
                    this._bonusRoomLabel.color = flash
                        ? new Color(255, 80, 80, 255)
                        : new Color(255, 200, 50, 255);
                } else {
                    this._bonusRoomLabel.color = new Color(255, 200, 50, 255);
                }
            } else {
                this._bonusRoomLabel.string = '';
            }
        }
    }

    update(dt: number) {
        // 无敌倒计时更新
        if (this._showInvincible && this._invincibleTimeLeft > 0) {
            this._invincibleTimeLeft -= dt;
            if (this._invincibleTimeLeft <= 0) {
                this._invincibleTimeLeft = 0;
                this._showInvincible = false;
            }
            this.updateInvincibleStatus(this._showInvincible, this._invincibleTimeLeft);
        }

        // 冲刺倒计时更新
        if (this._showDash && this._dashTimeLeft > 0) {
            this._dashTimeLeft -= dt;
            if (this._dashTimeLeft <= 0) {
                this._dashTimeLeft = 0;
                this._showDash = false;
            }
            this.updateDashStatus(this._showDash, this._dashTimeLeft);
        }

        // 奖励房间倒计时更新（由GameManager直接调用updateBonusRoomStatus更新）
    }

    public updateScore(score: number) {
        this._score = score;
        if (this.scoreLabel) {
            this.scoreLabel.string = `${score}`;
        }
    }

    public updatePoleIndicator(pole: MagneticPole) {
        if (this.poleLabel) {
            this.poleLabel.string = pole === MagneticPole.N ? 'N' : 'S';
            this.poleLabel.color = pole === MagneticPole.N
                ? new Color(255, 80, 80, 255)
                : new Color(80, 80, 255, 255);
        }
    }

    public showStartPanel() {
        this.setPanelVisible(this.startPanel, true);
        this.setPanelVisible(this.gameOverPanel, false);
    }

    public showGameOverPanel() {
        if (this._score > this._bestScore) {
            this._bestScore = this._score;
            localStorage.setItem('magneticJump_bestScore', this._bestScore.toString());
        }

        if (this.finalScoreLabel) {
            this.finalScoreLabel.string = `${this._score}`;
        }
        if (this.bestScoreLabel) {
            this.bestScoreLabel.string = `${this._bestScore}`;
        }

        this.setPanelVisible(this.startPanel, false);
        this.setPanelVisible(this.gameOverPanel, true);
    }

    public hideAllPanels() {
        this.setPanelVisible(this.startPanel, false);
        this.setPanelVisible(this.gameOverPanel, false);
    }

    private setPanelVisible(panel: Node | null, visible: boolean) {
        if (panel) {
            panel.active = visible;
        }
    }

    public onStartButtonClicked() {
        this.onStartClicked?.();
    }

    public onRestartButtonClicked() {
        this.onRestartClicked?.();
    }

    public onBackToMainButtonClicked() {
        this.onBackToMainClicked?.();
    }

    public reset() {
        this._score = 0;
        this.updateScore(0);
        this.updatePoleIndicator(MagneticPole.N);
        this.updateFieldStatus(0);
        this.updateLives(3);
        this.updateInvincibleStatus(false);
        this.updateDashStatus(false);
        this.updateBonusRoomStatus(false);
    }
}
