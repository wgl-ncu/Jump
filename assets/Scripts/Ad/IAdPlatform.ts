/**
 * 广告平台抽象接口
 *
 * 所有平台的广告实现都遵循此接口。
 * 新增平台时只需实现此接口，然后在 AdManager 中注册即可。
 */

import { IRewardedVideoAd, IBannerAd, IInterstitialAd, IBannerStyle } from './AdTypes';

export interface IAdPlatform {
    /** 平台名称标识，如 'wechat'、'oppo'、'vivo' 等 */
    readonly platformName: string;

    /** 当前平台是否支持广告（运行时检测） */
    isSupported(): boolean;

    /** 创建激励视频广告实例 */
    createRewardedVideoAd(adUnitId: string): IRewardedVideoAd;

    /** 创建 Banner 广告实例 */
    createBannerAd(adUnitId: string, style?: IBannerStyle): IBannerAd;

    /** 创建插屏广告实例 */
    createInterstitialAd(adUnitId: string): IInterstitialAd;
}
