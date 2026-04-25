import { _decorator, Component, Graphics, Color } from 'cc';
import { MagneticPole, Player } from './Player';
const { ccclass, property } = _decorator;

/**
 * 磁极指示器 - 在主角周围显示磁极标记环
 * N极向右箭头，S极向左箭头
 * 增强版：显示与带磁极障碍物的交互状态
 */
@ccclass('PoleIndicator')
export class PoleIndicator extends Component {

    @property({ tooltip: '关联的玩家' })
    public player: Player | null = null;

    private _graphics: Graphics | null = null;

    /** 当前反转系数 */
    private _reversalFactor: number = 0;

    start() {
        this._graphics = this.node.getComponent(Graphics);
        if (!this._graphics) {
            this._graphics = this.node.addComponent(Graphics);
        }
        this.drawIndicator(MagneticPole.N);
    }

    /**
     * 设置反转系数
     */
    public setReversalFactor(factor: number) {
        this._reversalFactor = factor;
    }

    update(_dt: number) {
        if (this.player) {
            this.node.setPosition(this.player.node.position);
            this.drawIndicator(this.player.currentPole);
        }
    }

    private drawIndicator(pole: MagneticPole) {
        if (!this._graphics) return;

        this._graphics.clear();

        const isN = pole === MagneticPole.N;

        // 反转时显示紫色外环
        if (this._reversalFactor > 0.1) {
            this._graphics.strokeColor = new Color(180, 80, 255, Math.floor(120 * this._reversalFactor));
            this._graphics.lineWidth = 2;
            this._graphics.circle(0, 0, 40);
            this._graphics.stroke();
        }

        // 基础磁极环
        if (isN) {
            this._graphics.strokeColor = new Color(255, 80, 80, 180);
            this._graphics.lineWidth = 3;
            this._graphics.circle(0, 0, 34);
            this._graphics.stroke();
            // 右箭头
            this._graphics.fillColor = new Color(255, 80, 80, 150);
            this._graphics.moveTo(28, 0);
            this._graphics.lineTo(16, -8);
            this._graphics.lineTo(16, 8);
            this._graphics.close();
            this._graphics.fill();
        } else {
            this._graphics.strokeColor = new Color(80, 80, 255, 180);
            this._graphics.lineWidth = 3;
            this._graphics.circle(0, 0, 34);
            this._graphics.stroke();
            // 左箭头
            this._graphics.fillColor = new Color(80, 80, 255, 150);
            this._graphics.moveTo(-28, 0);
            this._graphics.lineTo(-16, -8);
            this._graphics.lineTo(-16, 8);
            this._graphics.close();
            this._graphics.fill();
        }

        // 反转方向箭头（半透明，表示实际移动方向）
        if (this._reversalFactor > 0.3) {
            const alpha = Math.floor(100 * this._reversalFactor);
            // 反转后实际方向与原来相反
            if (!isN) {
                // 反转后S极实际向右
                this._graphics.fillColor = new Color(80, 80, 255, alpha);
                this._graphics.moveTo(28, 0);
                this._graphics.lineTo(16, -8);
                this._graphics.lineTo(16, 8);
                this._graphics.close();
                this._graphics.fill();
            } else {
                // 反转后N极实际向左
                this._graphics.fillColor = new Color(255, 80, 80, alpha);
                this._graphics.moveTo(-28, 0);
                this._graphics.lineTo(-16, -8);
                this._graphics.lineTo(-16, 8);
                this._graphics.close();
                this._graphics.fill();
            }
        }
    }
}
