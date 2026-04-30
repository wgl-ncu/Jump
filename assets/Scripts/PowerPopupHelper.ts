import { resources, SpriteFrame } from 'cc';
import { AdManager } from './Ad';
import { CommonPopUI, CommonPopUILayout } from './CommonPopUI';
import { PowerManager } from './PowerManager';
import { UIFrame } from './UI/UIFrame';

export class PowerPopupHelper {

    private static readonly POWER_POPUP_ICON_PATH = 'Art/UI/PowerIcon/spriteFrame';
    private static readonly POWER_REWARD_AMOUNT = 30;
    private static readonly POWER_REWARDED_AD_KEYS = ['power', 'revive'];

    private static _powerPopupOpening = false;
    private static _powerIconFrame: SpriteFrame | null = null;

    public static showInsufficientPowerPopup(onRewarded?: () => void): void {
        CommonPopUI.show({
            layout: CommonPopUILayout.Text,
            text: `体力不足，开始游戏至少需要 ${PowerManager.GAME_START_COST} 点体力。`,
            buttons: [
                {
                    text: '去获取体力',
                    onClick: () => {
                        this.showPowerRewardPopup(onRewarded);
                    },
                },
                {
                    text: '取消',
                },
            ],
        });
    }

    public static showPowerRewardPopup(onRewarded?: () => void): void {
        if (this._powerPopupOpening) {
            return;
        }

        this._powerPopupOpening = true;
        this.loadPowerIcon((icon) => {
            this._powerPopupOpening = false;
            CommonPopUI.show({
                layout: CommonPopUILayout.ImageText,
                icon,
                text: `立即获取体力x${this.POWER_REWARD_AMOUNT}`,
                buttons: [
                    {
                        text: '确定',
                        onClick: () => {
                            void this.handlePowerRewardConfirmed(onRewarded);
                        },
                    },
                    {
                        text: '取消',
                    },
                ],
            });
        });
    }

    private static async handlePowerRewardConfirmed(onRewarded?: () => void): Promise<void> {
        const rewardedAdKey = this.resolvePowerRewardedAdKey();
        if (!rewardedAdKey) {
            UIFrame.getInstance().toast('激励广告未配置');
            return;
        }

        const watched = await AdManager.getInstance().showRewardedVideo(rewardedAdKey);
        if (!watched) {
            UIFrame.getInstance().toast('广告未完整观看，未获得体力');
            return;
        }

        PowerManager.getInstance().addPower(this.POWER_REWARD_AMOUNT);
        onRewarded?.();
        UIFrame.getInstance().toast(`体力+${this.POWER_REWARD_AMOUNT}`);
    }

    private static resolvePowerRewardedAdKey(): string | null {
        const adManager = AdManager.getInstance();
        if (!adManager.isInitialized) {
            return null;
        }

        for (const key of this.POWER_REWARDED_AD_KEYS) {
            if (adManager.getRewardedVideoAd(key)) {
                return key;
            }
        }

        return null;
    }

    private static loadPowerIcon(onLoaded: (icon: SpriteFrame | null) => void): void {
        if (this._powerIconFrame) {
            onLoaded(this._powerIconFrame);
            return;
        }

        resources.load(this.POWER_POPUP_ICON_PATH, SpriteFrame, (error, spriteFrame) => {
            if (error || !spriteFrame) {
                console.warn('[PowerPopupHelper] 体力图标加载失败', error);
                onLoaded(null);
                return;
            }

            this._powerIconFrame = spriteFrame;
            onLoaded(spriteFrame);
        });
    }
}