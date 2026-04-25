import { _decorator, Component, Node, Graphics, Color, UITransform, Size } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 磁场反转区域
 */
export interface ReverseRegion {
    topY: number;       // 区域上边界Y（世界坐标）
    bottomY: number;    // 区域下边界Y（世界坐标）
    active: boolean;    // 是否激活
    transitionProgress: number;  // 过渡进度 0~1
    visualNode: Node | null;     // 视觉节点
}

/**
 * 磁场区域管理器
 * 管理磁场反转区域的生成、检测和过渡
 */
@ccclass('MagneticZoneManager')
export class MagneticZoneManager extends Component {

    @property({ tooltip: '反转区域出现最低分数' })
    public minScoreForReverse: number = 25;

    @property({ tooltip: '反转区域最小通过时间（秒）' })
    public minPassDuration: number = 8;

    @property({ tooltip: '反转区域最大通过时间（秒）' })
    public maxPassDuration: number = 12;

    @property({ tooltip: '过渡插值速度（秒）' })
    public transitionDuration: number = 0.3;

    @property({ tooltip: '反转区域生成间隔（秒）' })
    public spawnInterval: number = 30;

    /** 当前是否处于反转状态（0~1插值） */
    private _reversalFactor: number = 0;

    /** 反转区域列表 */
    private _regions: ReverseRegion[] = [];

    /** 玩家Y位置 */
    private _playerY: number = 200;

    /** 是否运行中 */
    private _running: boolean = false;

    /** 生成计时 */
    private _spawnTimer: number = 0;

    /** 当前分数 */
    private _currentScore: number = 0;

    /** 障碍物移动速度 */
    private _scrollSpeed: number = 300;

    /** 游戏区域宽度 */
    private _playWidth: number = 620;

    /** 已生成的区域计数 */
    private _regionCount: number = 0;

    /** 场景设计高度 */
    private readonly DESIGN_H: number = 1280;

    public get reversalFactor(): number {
        return this._reversalFactor;
    }

    public setPlayerY(y: number) {
        this._playerY = y;
    }

    public setPlayWidth(w: number) {
        this._playWidth = w;
    }

    public startZones() {
        this._running = true;
        this._spawnTimer = 0;
        this._regionCount = 0;
        this.clearAll();
    }

    public stopZones() {
        this._running = false;
    }

    public setScore(score: number) {
        this._currentScore = score;
    }

    public setScrollSpeed(speed: number) {
        this._scrollSpeed = speed;
    }

    public clearAll() {
        for (const region of this._regions) {
            if (region.visualNode && region.visualNode.isValid) {
                region.visualNode.destroy();
            }
        }
        this._regions = [];
        this._reversalFactor = 0;
    }

    /**
     * 检查指定Y位置附近是否有反转区域边界
     * 用于在障碍物生成位置预判反转过渡，提前放置带磁极障碍物
     * @param y 检查的Y位置（通常是障碍物生成Y）
     * @param range 检查范围（像素）
     * @returns near=附近有边界, enteringZone=是进入反转区域(底部边界)还是离开(顶部边界)
     */
    public isNearTransition(y: number, range: number = 300): { near: boolean, enteringZone: boolean } {
        for (const region of this._regions) {
            if (!region.active) continue;
            // 底部边界接近 → 即将进入反转区域
            if (Math.abs(region.bottomY - y) < range) {
                return { near: true, enteringZone: true };
            }
            // 顶部边界接近 → 即将离开反转区域
            if (Math.abs(region.topY - y) < range) {
                return { near: true, enteringZone: false };
            }
        }
        return { near: false, enteringZone: false };
    }

    update(dt: number) {
        if (!this._running) return;

        // 生成新区域
        if (this._currentScore >= this.minScoreForReverse) {
            this._spawnTimer += dt;
            if (this._spawnTimer >= this.spawnInterval) {
                this._spawnTimer = 0;
                this.spawnReverseRegion();
            }
        }

        // 更新区域位置（向上滚动）
        for (const region of this._regions) {
            region.topY += this._scrollSpeed * dt;
            region.bottomY += this._scrollSpeed * dt;

            // 更新视觉节点位置
            if (region.visualNode && region.visualNode.isValid) {
                const centerY = (region.topY + region.bottomY) / 2;
                region.visualNode.setPosition(0, centerY, 0);
            }
        }

        // 检测玩家是否在反转区域内
        let inReverse = false;
        for (const region of this._regions) {
            if (region.active && this._playerY >= region.bottomY && this._playerY <= region.topY) {
                inReverse = true;
                break;
            }
        }

        // 平滑过渡
        const target = inReverse ? 1 : 0;
        const step = dt / this.transitionDuration;
        if (this._reversalFactor < target) {
            this._reversalFactor = Math.min(target, this._reversalFactor + step);
        } else if (this._reversalFactor > target) {
            this._reversalFactor = Math.max(target, this._reversalFactor - step);
        }

        // 清理超出屏幕的区域
        this._regions = this._regions.filter(region => {
            if (region.bottomY > this.DESIGN_H / 2 + 200) {
                if (region.visualNode && region.visualNode.isValid) {
                    region.visualNode.destroy();
                }
                return false;
            }
            return true;
        });
    }

    /**
     * 生成一个反转区域
     */
    private spawnReverseRegion() {
        // 根据通过时间和当前滚动速度计算区域高度
        const duration = this.minPassDuration + Math.random() * (this.maxPassDuration - this.minPassDuration);
        const height = duration * this._scrollSpeed;
        const spawnY = -this.DESIGN_H / 2 - height / 2;

        const region: ReverseRegion = {
            topY: spawnY + height / 2,
            bottomY: spawnY - height / 2,
            active: true,
            transitionProgress: 0,
            visualNode: null
        };

        // 创建视觉节点
        const visualNode = this.createReverseVisual(height);
        visualNode.setParent(this.node);
        visualNode.setPosition(0, spawnY, 0);
        region.visualNode = visualNode;

        this._regions.push(region);
        this._regionCount++;
    }

    /**
     * 创建反转区域视觉
     */
    private createReverseVisual(height: number): Node {
        const node = new Node('ReverseZone_' + this._regionCount);
        const ut = node.addComponent(UITransform);
        ut.setContentSize(new Size(this._playWidth, height));

        const gfx = node.addComponent(Graphics);
        const halfW = this._playWidth / 2;
        const halfH = height / 2;

        // 紫色半透明背景
        gfx.fillColor = new Color(120, 40, 180, 20);
        gfx.rect(-halfW, -halfH, this._playWidth, height);
        gfx.fill();

        // 上下边界虚线
        gfx.strokeColor = new Color(180, 80, 255, 100);
        gfx.lineWidth = 2;

        // 上边界
        this.drawDashedLine(gfx, -halfW, halfH, halfW, halfH, 20);
        // 下边界
        this.drawDashedLine(gfx, -halfW, -halfH, halfW, -halfH, 20);

        // 反转标记 - 左右交换指示
        gfx.strokeColor = new Color(180, 80, 255, 60);
        gfx.lineWidth = 1;

        // 左侧S标记
        gfx.strokeColor = new Color(80, 80, 255, 80);
        gfx.lineWidth = 2;
        this.drawDashedLine(gfx, -halfW, -halfH, -halfW, halfH, 15);

        // 右侧N标记
        gfx.strokeColor = new Color(255, 80, 80, 80);
        gfx.lineWidth = 2;
        this.drawDashedLine(gfx, halfW, -halfH, halfW, halfH, 15);

        // 反转箭头装饰（斜线）
        gfx.strokeColor = new Color(160, 60, 220, 35);
        gfx.lineWidth = 1;
        const spacing = 40;
        for (let y = -halfH + spacing; y < halfH; y += spacing) {
            gfx.moveTo(-halfW + 10, y);
            gfx.lineTo(-halfW + 30, y - 15);
        }
        for (let y = -halfH + spacing; y < halfH; y += spacing) {
            gfx.moveTo(halfW - 10, y);
            gfx.lineTo(halfW - 30, y - 15);
        }
        gfx.stroke();

        return node;
    }

    /**
     * 绘制虚线
     */
    private drawDashedLine(gfx: Graphics, x1: number, y1: number, x2: number, y2: number, dashLen: number) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const count = Math.floor(dist / dashLen);
        const ux = dx / dist;
        const uy = dy / dist;

        for (let i = 0; i < count; i += 2) {
            const sx = x1 + ux * i * dashLen;
            const sy = y1 + uy * i * dashLen;
            const ex = x1 + ux * Math.min((i + 1) * dashLen, dist);
            const ey = y1 + uy * Math.min((i + 1) * dashLen, dist);
            gfx.moveTo(sx, sy);
            gfx.lineTo(ex, ey);
        }
        gfx.stroke();
    }
}
