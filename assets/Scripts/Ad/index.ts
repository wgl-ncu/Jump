/**
 * 广告系统统一入口
 *
 * 使用方式：
 * ```ts
 * import { AdManager, AdType } from './Ad';
 * ```
 */

export { AdManager } from './AdManager';
export { IAdPlatform } from './IAdPlatform';
export { WeChatAdPlatform } from './WeChatAdPlatform';
export { MockAdPlatform } from './MockAdPlatform';
export {
    AdType,
    IAdConfig,
    IAdUnitConfig,
    IAdError,
    IBannerStyle,
    IRewardedVideoAd,
    IBannerAd,
    IInterstitialAd,
} from './AdTypes';
