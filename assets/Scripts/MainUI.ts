import { _decorator, Button, Color, Label, Node, UITransform, Size, director } from 'cc';
import { AdManager } from './Ad';
import { CommonPopUI, CommonPopUILayout } from './CommonPopUI';
import { GrowthManager } from './GrowthManager';
import { ItemManager, MetaItemId } from './ItemManager';
import { PowerPopupHelper } from './PowerPopupHelper';
import { PowerManager } from './PowerManager';
import { UIPanel } from './UI/UIPanel';
import { UIFrame } from './UI/UIFrame';

const { ccclass } = _decorator;

/**
 * 主界面UI - 在main场景中使用
 * 通过 UIFrame 管理面板生命周期
 * 继承 UIPanel，预制体路径通过 UIFrame.registerPrefab 注册
 */
@ccclass('MainUI')
export class MainUI extends UIPanel {

    private static readonly POWER_ROOT_PATHS = ['Top/Power', 'Power'];
    private static readonly GUARDIAN_WING_REWARDED_AD_KEYS = ['revive', 'power'];
    private static readonly RAPID_DASH_REWARDED_AD_KEYS = ['revive', 'power'];

    private _starting = false;
    private _startButton: Button | null = null;
    private _powerLabel: Label | null = null;
    private _goldLabel: Label | null = null;
    private _growthEntryNode: Node | null = null;
    private _growthLabel: Label | null = null;
    private _guardianWingEntryNode: Node | null = null;
    private _guardianWingLabel: Label | null = null;
    private _rapidDashEntryNode: Node | null = null;
    private _rapidDashLabel: Label | null = null;

    public onOpenPowerPopup: (() => void) | null = null;

    private readonly refreshPowerDisplay = (): void => {
        const powerState = PowerManager.getInstance().getState();

        if (this._powerLabel) {
            this._powerLabel.string = `${powerState.currentPower}/${powerState.naturalRecoveryLimit}`;
        }

        this.refreshGoldDisplay();
        this.refreshGrowthDisplay();
        this.refreshGuardianWingDisplay();
        this.refreshRapidDashDisplay();

        if (this._startButton) {
            this._startButton.interactable = !this._starting;
        }
    };

    protected onPanelInit(): void {
        const startBtnNode = this.node.getChildByPath('BtnGroup/StartBtn');
        if (!startBtnNode) {
            console.error('[MainUI] 未找到 StartBtn 节点');
            return;
        }

        this._startButton = startBtnNode.getComponent(Button);
        this._powerLabel = this.findPowerNode('PowerNum')?.getComponent(Label) ?? null;
        this.createGoldDisplay();
        this.createGrowthEntry();
        this.createGuardianWingEntry();
        this.createRapidDashEntry();

        const powerBtnNode = this.findPowerNode('PowerBtn');
        if (!powerBtnNode) {
            console.warn('[MainUI] 未找到 PowerBtn 节点');
        }

        startBtnNode.on(Node.EventType.TOUCH_END, this.handleStartClicked, this);
        powerBtnNode?.on(Node.EventType.TOUCH_END, this.handlePowerButtonClicked, this);
        this.refreshPowerDisplay();
    }

    protected onPanelOpen(data?: any): void {
        super.onPanelOpen(data);
        this._starting = false;
        this.refreshPowerDisplay();
        this.unschedule(this.refreshPowerDisplay);
        this.schedule(this.refreshPowerDisplay, 1);
    }

    protected onPanelClose(): void {
        this.unschedule(this.refreshPowerDisplay);
        this._starting = false;
        this.refreshPowerDisplay();
        super.onPanelClose();
    }

    protected onPanelDestroy(): void {
        this.unschedule(this.refreshPowerDisplay);
        this.node.getChildByPath('BtnGroup/StartBtn')?.off(Node.EventType.TOUCH_END, this.handleStartClicked, this);
        this.findPowerNode('PowerBtn')?.off(Node.EventType.TOUCH_END, this.handlePowerButtonClicked, this);
    }

    private findPowerNode(childName: string): Node | null {
        for (const rootPath of MainUI.POWER_ROOT_PATHS) {
            const node = this.node.getChildByPath(`${rootPath}/${childName}`);
            if (node) {
                return node;
            }
        }

        return null;
    }

    private findPowerRoot(): Node | null {
        for (const rootPath of MainUI.POWER_ROOT_PATHS) {
            const node = this.node.getChildByPath(rootPath);
            if (node) {
                return node;
            }
        }

        return null;
    }

    private createGuardianWingEntry(): void {
        if (this._guardianWingEntryNode?.isValid) return;

        const { node, label } = this.createMetaItemEntry('GuardianWingEntry', 170, this.handleGuardianWingClicked);
        this._guardianWingEntryNode = node;
        this._guardianWingLabel = label;
        this.refreshGuardianWingDisplay();
    }

    private createRapidDashEntry(): void {
        if (this._rapidDashEntryNode?.isValid) return;

        const { node, label } = this.createMetaItemEntry('RapidDashEntry', 230, this.handleRapidDashClicked);
        this._rapidDashEntryNode = node;
        this._rapidDashLabel = label;
        this.refreshRapidDashDisplay();
    }

    private createGoldDisplay(): void {
        if (this._goldLabel) {
            return;
        }

        const referenceNode = this.findPowerRoot();
        const host = referenceNode?.parent ?? this.node;
        const goldNode = new Node('GrowthGoldLabel');
        goldNode.setParent(host);

        if (referenceNode) {
            goldNode.setPosition(referenceNode.position.x, referenceNode.position.y - 70, 0);
        } else {
            goldNode.setPosition(0, -220, 0);
        }

        const transform = goldNode.addComponent(UITransform);
        transform.setContentSize(new Size(320, 40));

        const label = goldNode.addComponent(Label);
        label.fontSize = 24;
        label.lineHeight = 28;
        label.color = new Color(255, 225, 120, 255);
        this._goldLabel = label;
        this.refreshGoldDisplay();
    }

    private createGrowthEntry(): void {
        if (this._growthEntryNode?.isValid) return;

        const { node, label } = this.createMetaItemEntry('GrowthEntry', 110, this.handleGrowthClicked);
        this._growthEntryNode = node;
        this._growthLabel = label;
        this.refreshGrowthDisplay();
    }

    private createMetaItemEntry(name: string, offsetY: number, handler: () => void): { node: Node; label: Label } {
        const referenceNode = this.findPowerRoot();
        const host = referenceNode?.parent ?? this.node;
        const itemNode = new Node(name);
        itemNode.setParent(host);

        if (referenceNode) {
            itemNode.setPosition(referenceNode.position.x, referenceNode.position.y - offsetY, 0);
        } else {
            itemNode.setPosition(0, -260 - (offsetY - 110), 0);
        }

        const transform = itemNode.addComponent(UITransform);
        transform.setContentSize(new Size(320, 48));
    itemNode.addComponent(Button);

        const label = itemNode.addComponent(Label);
        label.fontSize = 24;
        label.lineHeight = 28;

        itemNode.on(Node.EventType.TOUCH_END, handler, this);
        return { node: itemNode, label };
    }

    private refreshGoldDisplay(): void {
        if (!this._goldLabel) {
            return;
        }

        this._goldLabel.string = `金币 ${GrowthManager.getInstance().getGoldText()}`;
    }

    private refreshGrowthDisplay(): void {
        if (!this._growthLabel) {
            return;
        }

        const growthManager = GrowthManager.getInstance();
        const upgradeableCount = growthManager
            .getAllUpgradeStates()
            .filter((state) => growthManager.canUpgrade(state.definition.Id))
            .length;

        this._growthLabel.string = upgradeableCount > 0
            ? `成长系统  可升级 ${upgradeableCount} 项`
            : '成长系统  点击升级';
        this._growthLabel.color = upgradeableCount > 0
            ? new Color(125, 255, 160, 255)
            : new Color(210, 210, 210, 255);
    }

    private refreshGuardianWingDisplay(): void {
        if (!this._guardianWingLabel) {
            return;
        }

        const itemManager = ItemManager.getInstance();
        const definition = itemManager.getDefinition(MetaItemId.GuardianWing);
        const count = itemManager.getOwnedCount(MetaItemId.GuardianWing);

        this._guardianWingLabel.string = `${definition.name} x${count}  点击获取`;
        this._guardianWingLabel.color = count > 0
            ? new Color(255, 214, 102, 255)
            : new Color(210, 210, 210, 255);
    }

    private refreshRapidDashDisplay(): void {
        if (!this._rapidDashLabel) {
            return;
        }

        const itemManager = ItemManager.getInstance();
        const definition = itemManager.getDefinition(MetaItemId.RapidDash);
        const count = itemManager.getOwnedCount(MetaItemId.RapidDash);

        this._rapidDashLabel.string = `${definition.name} x${count}  点击获取`;
        this._rapidDashLabel.color = count > 0
            ? new Color(255, 160, 70, 255)
            : new Color(210, 210, 210, 255);
    }

    private handleGrowthClicked(): void {
        UIFrame.getInstance().open('GrowthUI', {
            cache: false,
        });
    }

    private handleStartClicked(): void {
        if (this._starting) return;

        if (!PowerManager.getInstance().tryConsumeForGame()) {
            PowerPopupHelper.showInsufficientPowerPopup(() => this.refreshPowerDisplay());
            this.refreshPowerDisplay();
            return;
        }

        this._starting = true;
        this.refreshPowerDisplay();

        // UIFrame 是持久化节点，切场景前先立即隐藏并清空面板栈，避免主界面残留到 battle。
        this.node.active = false;
        UIFrame.getInstance().closeAll();
        director.loadScene('battle');
    }

    private handlePowerButtonClicked(): void {
        this.openPowerPopup();
    }

    private handleGuardianWingClicked(): void {
        const itemManager = ItemManager.getInstance();
        const definition = itemManager.getDefinition(MetaItemId.GuardianWing);
        const count = itemManager.getOwnedCount(MetaItemId.GuardianWing);

        CommonPopUI.show({
            layout: CommonPopUILayout.Text,
            text: `${definition.name} x${count}\n${definition.description}\n局外持有，局内自动生效；同种道具每局最多生效 1 个。`,
            buttons: [
                {
                    text: '获取1个',
                    onClick: () => {
                        void this.handleGuardianWingRewardConfirmed();
                    },
                },
                {
                    text: '关闭',
                },
            ],
        });
    }

    private handleRapidDashClicked(): void {
        const itemManager = ItemManager.getInstance();
        const definition = itemManager.getDefinition(MetaItemId.RapidDash);
        const count = itemManager.getOwnedCount(MetaItemId.RapidDash);

        CommonPopUI.show({
            layout: CommonPopUILayout.Text,
            text: `${definition.name} x${count}\n${definition.description}\n局外持有，局内自动生效；同种道具每局最多生效 1 个。`,
            buttons: [
                {
                    text: '获取1个',
                    onClick: () => {
                        void this.handleRapidDashRewardConfirmed();
                    },
                },
                {
                    text: '关闭',
                },
            ],
        });
    }

    private openPowerPopup(): void {
        if (this.onOpenPowerPopup) {
            this.onOpenPowerPopup();
            return;
        }

        PowerPopupHelper.showPowerRewardPopup(() => {
            if (this.node.isValid) {
                this.refreshPowerDisplay();
            }
        });
    }

    private async handleGuardianWingRewardConfirmed(): Promise<void> {
        const rewardedAdKey = this.resolveGuardianWingRewardedAdKey();
        if (!rewardedAdKey) {
            UIFrame.getInstance().toast('激励广告未配置');
            return;
        }

        const watched = await AdManager.getInstance().showRewardedVideo(rewardedAdKey);
        if (!this.node.isValid) {
            return;
        }

        if (!watched) {
            UIFrame.getInstance().toast('广告未完整观看，未获得守护之翼');
            return;
        }

        ItemManager.getInstance().addItem(MetaItemId.GuardianWing, 1);
        this.refreshGuardianWingDisplay();
        UIFrame.getInstance().toast('守护之翼+1');
    }

    private async handleRapidDashRewardConfirmed(): Promise<void> {
        const rewardedAdKey = this.resolveRapidDashRewardedAdKey();
        if (!rewardedAdKey) {
            UIFrame.getInstance().toast('激励广告未配置');
            return;
        }

        const watched = await AdManager.getInstance().showRewardedVideo(rewardedAdKey);
        if (!this.node.isValid) {
            return;
        }

        if (!watched) {
            UIFrame.getInstance().toast('广告未完整观看，未获得急速冲刺');
            return;
        }

        ItemManager.getInstance().addItem(MetaItemId.RapidDash, 1);
        this.refreshRapidDashDisplay();
        UIFrame.getInstance().toast('急速冲刺+1');
    }

    private resolveGuardianWingRewardedAdKey(): string | null {
        const adManager = AdManager.getInstance();
        if (!adManager.isInitialized) {
            return null;
        }

        for (const key of MainUI.GUARDIAN_WING_REWARDED_AD_KEYS) {
            if (adManager.getRewardedVideoAd(key)) {
                return key;
            }
        }

        return null;
    }

    private resolveRapidDashRewardedAdKey(): string | null {
        const adManager = AdManager.getInstance();
        if (!adManager.isInitialized) {
            return null;
        }

        for (const key of MainUI.RAPID_DASH_REWARDED_AD_KEYS) {
            if (adManager.getRewardedVideoAd(key)) {
                return key;
            }
        }

        return null;
    }
}
