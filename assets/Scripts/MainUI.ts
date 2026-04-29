import { _decorator, Button, Label, Node, director, resources, SpriteFrame } from 'cc';
import { AdManager } from './Ad';
import { CommonPopUI, CommonPopUILayout } from './CommonPopUI';
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
    private static readonly POWER_POPUP_ICON_PATH = 'Art/UI/PowerIcon/spriteFrame';
    private static readonly POWER_REWARD_AMOUNT = 30;
    private static readonly POWER_REWARDED_AD_KEYS = ['power', 'revive'];

    private _starting = false;
    private _startButton: Button | null = null;
    private _powerLabel: Label | null = null;
    private _powerPopupOpening = false;
    private _powerIconFrame: SpriteFrame | null = null;

    public onOpenPowerPopup: (() => void) | null = null;

    private readonly refreshPowerDisplay = (): void => {
        const powerState = PowerManager.getInstance().getState();

        if (this._powerLabel) {
            this._powerLabel.string = `${powerState.currentPower}/${powerState.naturalRecoveryLimit}`;
        }

        if (this._startButton) {
            this._startButton.interactable = !this._starting
                && powerState.currentPower >= PowerManager.GAME_START_COST;
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

    private handleStartClicked(): void {
        if (this._starting) return;

        if (!PowerManager.getInstance().tryConsumeForGame()) {
            UIFrame.getInstance().toast('体力不足，至少需要 5 点');
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

    private openPowerPopup(): void {
        if (this.onOpenPowerPopup) {
            this.onOpenPowerPopup();
            return;
        }

        if (this._powerPopupOpening) {
            return;
        }

        this._powerPopupOpening = true;
        this.loadPowerIcon((icon) => {
            this._powerPopupOpening = false;
            this.showDefaultPowerPopup(icon);
        });
    }

    private showDefaultPowerPopup(icon: SpriteFrame | null): void {
        CommonPopUI.show({
            layout: CommonPopUILayout.ImageText,
            icon,
            text: `立即获取体力x${MainUI.POWER_REWARD_AMOUNT}`,
            buttons: [
                {
                    text: '确定',
                    onClick: () => {
                        void this.handlePowerRewardConfirmed();
                    },
                },
                {
                    text: '取消',
                },
            ],
        });
    }

    private async handlePowerRewardConfirmed(): Promise<void> {
        const rewardedAdKey = this.resolvePowerRewardedAdKey();
        if (!rewardedAdKey) {
            UIFrame.getInstance().toast('激励广告未配置');
            return;
        }

        const watched = await AdManager.getInstance().showRewardedVideo(rewardedAdKey);
        if (!this.node.isValid) {
            return;
        }

        if (!watched) {
            UIFrame.getInstance().toast('广告未完整观看，未获得体力');
            return;
        }

        PowerManager.getInstance().addPower(MainUI.POWER_REWARD_AMOUNT);
        this.refreshPowerDisplay();
        UIFrame.getInstance().toast(`体力+${MainUI.POWER_REWARD_AMOUNT}`);
    }

    private resolvePowerRewardedAdKey(): string | null {
        const adManager = AdManager.getInstance();
        if (!adManager.isInitialized) {
            return null;
        }

        for (const key of MainUI.POWER_REWARDED_AD_KEYS) {
            if (adManager.getRewardedVideoAd(key)) {
                return key;
            }
        }

        return null;
    }

    private loadPowerIcon(onLoaded: (icon: SpriteFrame | null) => void): void {
        if (this._powerIconFrame) {
            onLoaded(this._powerIconFrame);
            return;
        }

        resources.load(MainUI.POWER_POPUP_ICON_PATH, SpriteFrame, (error, spriteFrame) => {
            if (error || !spriteFrame) {
                console.warn('[MainUI] 体力图标加载失败', error);
                onLoaded(null);
                return;
            }

            this._powerIconFrame = spriteFrame;
            onLoaded(spriteFrame);
        });
    }
}
