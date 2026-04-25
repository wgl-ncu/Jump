import { _decorator, Component, Node, Label, Color, Overflow, HorizontalTextAlignment, UITransform, Size, Vec3, tween, Tween } from 'cc';
import { TextManager } from '../Data/TextManager';
import { TextId } from '../Data/TextId';

const { ccclass, property } = _decorator;

/**
 * UIHUD - 游戏内 HUD 组件
 *
 * 从原 UIManager 中分离出来的 HUD 逻辑。
 * 只负责显示游戏内常驻信息：分数、磁极、生命值、状态指示器等。
 *
 * 使用方式：
 * - 由 SceneBuilder 创建 UILayer 节点后挂载
 * - 通过公开方法更新显示
 */
@ccclass('UIHUD')
export class UIHUD extends Component {

    // ---- 分数 ----
    private _scoreLabel: Label | null = null;
    private _score: number = 0;

    // ---- 磁极指示 ----
    private _poleLabel: Label | null = null;

    // ---- 磁场状态 ----
    private _fieldStatusLabel: Label | null = null;

    // ---- 生命值 ----
    private _livesLabel: Label | null = null;

    // ---- 无敌 ----
    private _invincibleLabel: Label | null = null;
    private _invincibleTimeLeft: number = 0;
    private _showInvincible: boolean = false;

    // ---- 冲刺 ----
    private _dashLabel: Label | null = null;
    private _dashTimeLeft: number = 0;
    private _showDash: boolean = false;

    // ---- 奖励房间 ----
    private _bonusRoomLabel: Label | null = null;
    private _bonusRoomTimeLeft: number = 0;
    private _showBonusRoom: boolean = false;

    /** 设计高度 */
    private readonly DH = 1280;

    start() {
        this.buildHUD();
    }

    // ==================== 构建 HUD ====================

    private buildHUD() {
        const topY = this.DH / 2 - 80;

        // 分数
        this._scoreLabel = this.createLabel('0', 0, topY, {
            fontSize: 48, color: Color.WHITE, name: 'ScoreLabel'
        });
        this._scoreLabel.node.getComponent(UITransform)!.setContentSize(new Size(200, 60));

        // 磁极指示器
        this._poleLabel = this.createLabel('N', -280, topY, {
            fontSize: 36, color: new Color(255, 80, 80, 255), name: 'PoleIndicator'
        });

        // 磁场状态
        this._fieldStatusLabel = this.createLabel('', -280, topY - 40, {
            fontSize: 18, color: new Color(180, 80, 255, 0), name: 'FieldStatus'
        });

        // 生命值
        this._livesLabel = this.createLabel('♥♥♥', 250, topY + 10, {
            fontSize: 24, color: new Color(255, 80, 80, 255), name: 'LivesIndicator'
        });
        this._livesLabel.horizontalAlign = HorizontalTextAlignment.RIGHT;

        // 无敌指示器
        this._invincibleLabel = this.createLabel('', 0, this.DH / 2 - 150, {
            fontSize: 22, color: new Color(100, 220, 255, 255), name: 'InvincibleIndicator'
        });

        // 冲刺指示器
        this._dashLabel = this.createLabel('', 0, this.DH / 2 - 180, {
            fontSize: 22, color: new Color(255, 180, 50, 255), name: 'DashIndicator'
        });

        // 奖励房间指示器
        this._bonusRoomLabel = this.createLabel('', 0, this.DH / 2 - 210, {
            fontSize: 28, color: new Color(255, 200, 50, 255), name: 'BonusRoomIndicator'
        });
    }

    private createLabel(text: string, x: number, y: number, opts: {
        fontSize?: number;
        color?: Color;
        name?: string;
    } = {}): Label {
        const { fontSize = 24, color = Color.WHITE, name = 'Label' } = opts;
        const node = new Node(name);
        node.setParent(this.node);
        node.setPosition(x, y, 0);

        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(120, 30));

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize;
        label.color = color;
        label.overflow = Overflow.NONE;
        label.horizontalAlign = HorizontalTextAlignment.CENTER;

        return label;
    }

    // ==================== 公开接口 ====================

    public updateScore(score: number) {
        this._score = score;
        if (this._scoreLabel) {
            this._scoreLabel.string = `${score}`;
        }
    }

    public updatePoleIndicator(pole: number) {
        if (!this._poleLabel) return;
        this._poleLabel.string = pole === 0 ? 'N' : 'S'; // 0=N, 1=S
        this._poleLabel.color = pole === 0
            ? new Color(255, 80, 80, 255)
            : new Color(80, 80, 255, 255);
    }

    public updateFieldStatus(reversalFactor: number) {
        if (!this._fieldStatusLabel) return;
        if (reversalFactor > 0.5) {
            this._fieldStatusLabel.string = TextManager.getInstance().getText(TextId.FieldReverse);
            this._fieldStatusLabel.color = new Color(200, 80, 255, Math.floor(255 * reversalFactor));
        } else if (reversalFactor > 0.05) {
            this._fieldStatusLabel.string = TextManager.getInstance().getText(TextId.FieldSwitching);
            this._fieldStatusLabel.color = new Color(180, 120, 220, Math.floor(180 * reversalFactor));
        } else {
            this._fieldStatusLabel.string = '';
            this._fieldStatusLabel.color = new Color(180, 80, 255, 0);
        }
    }

    public updateLives(lives: number) {
        if (!this._livesLabel) return;
        this._livesLabel.string = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
        this._livesLabel.color = lives < 3
            ? new Color(255, 80, 80, 255)
            : new Color(255, 120, 120, 255);
    }

    public updateInvincibleStatus(active: boolean, timeLeft: number = 0) {
        this._showInvincible = active;
        this._invincibleTimeLeft = timeLeft;
        if (!this._invincibleLabel) return;
        if (active && timeLeft > 0) {
            const seconds = Math.ceil(timeLeft);
            this._invincibleLabel.string = TextManager.formatText(TextId.Invincible, seconds);
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

    public updateDashStatus(active: boolean, timeLeft: number = 0) {
        this._showDash = active;
        this._dashTimeLeft = timeLeft;
        if (!this._dashLabel) return;
        if (active && timeLeft > 0) {
            const seconds = Math.ceil(timeLeft);
            this._dashLabel.string = TextManager.formatText(TextId.Dash, seconds);
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

    public updateBonusRoomStatus(active: boolean, timeLeft: number = 0) {
        this._showBonusRoom = active;
        this._bonusRoomTimeLeft = timeLeft;
        if (!this._bonusRoomLabel) return;
        if (active && timeLeft > 0) {
            const seconds = Math.ceil(timeLeft);
            this._bonusRoomLabel.string = TextManager.formatText(TextId.BonusRoom, seconds);
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

    /** 重置 HUD */
    public reset() {
        this.updateScore(0);
        this.updatePoleIndicator(0);
        this.updateFieldStatus(0);
        this.updateLives(3);
        this.updateInvincibleStatus(false);
        this.updateDashStatus(false);
        this.updateBonusRoomStatus(false);
    }

    // ==================== 倒计时 ====================

    update(dt: number) {
        if (this._showInvincible && this._invincibleTimeLeft > 0) {
            this._invincibleTimeLeft -= dt;
            if (this._invincibleTimeLeft <= 0) {
                this._invincibleTimeLeft = 0;
                this._showInvincible = false;
            }
            this.updateInvincibleStatus(this._showInvincible, this._invincibleTimeLeft);
        }

        if (this._showDash && this._dashTimeLeft > 0) {
            this._dashTimeLeft -= dt;
            if (this._dashTimeLeft <= 0) {
                this._dashTimeLeft = 0;
                this._showDash = false;
            }
            this.updateDashStatus(this._showDash, this._dashTimeLeft);
        }
    }
}
