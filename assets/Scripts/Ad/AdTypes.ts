/**
 * 广告系统类型定义
 *
 * 提供平台无关的广告类型、接口和错误定义，
 * 上层业务代码只依赖这些类型，无需关心底层平台。
 */

/** 广告类型枚举 */
export enum AdType {
    /** 激励视频广告 */
    RewardedVideo = 'rewardedVideo',
    /** Banner 广告 */
    Banner = 'banner',
    /** 插屏广告 */
    Interstitial = 'interstitial',
}

/** 广告错误 */
export interface IAdError {
    /** 错误码 */
    errCode: number;
    /** 错误信息 */
    errMsg: string;
}

/** Banner 广告样式参数 */
export interface IBannerStyle {
    /** 宽度 */
    width?: number;
    /** 高度 */
    height?: number;
    /** 顶部距离 */
    top?: number;
    /** 左侧距离 */
    left?: number;
}

// ─── 广告实例接口 ───────────────────────────────────────────

/**
 * 激励视频广告接口
 *
 * 典型用法：
 * ```ts
 * const ad = adManager.getRewardedVideoAd('revive');
 * ad.onClose = (isEnded) => { if (isEnded) grantReward(); };
 * ad.show();
 * ```
 * 或使用便捷方法：
 * ```ts
 * const watched = await adManager.showRewardedVideo('revive');
 * if (watched) grantReward();
 * ```
 */
export interface IRewardedVideoAd {
    /** 展示激励视频广告 */
    show(): Promise<void>;
    /** 预加载激励视频广告 */
    load(): Promise<void>;
    /** 销毁广告实例 */
    destroy(): void;

    /** 广告关闭回调，isEnded 表示用户是否看完广告 */
    onClose: ((isEnded: boolean) => void) | null;
    /** 广告错误回调 */
    onError: ((err: IAdError) => void) | null;
    /** 广告加载成功回调 */
    onLoad: (() => void) | null;
}

/**
 * Banner 广告接口
 */
export interface IBannerAd {
    /** 展示 Banner 广告 */
    show(): Promise<void>;
    /** 隐藏 Banner 广告 */
    hide(): void;
    /** 销毁广告实例 */
    destroy(): void;

    /** Banner 样式（可读写） */
    style: IBannerStyle;

    /** 广告错误回调 */
    onError: ((err: IAdError) => void) | null;
    /** 广告加载成功回调 */
    onLoad: (() => void) | null;
    /** Banner 尺寸变化回调 */
    onResize: ((size: { width: number; height: number }) => void) | null;
}

/**
 * 插屏广告接口
 */
export interface IInterstitialAd {
    /** 展示插屏广告 */
    show(): Promise<void>;
    /** 预加载插屏广告 */
    load(): Promise<void>;
    /** 销毁广告实例 */
    destroy(): void;

    /** 广告关闭回调 */
    onClose: (() => void) | null;
    /** 广告错误回调 */
    onError: ((err: IAdError) => void) | null;
    /** 广告加载成功回调 */
    onLoad: (() => void) | null;
}

// ─── 配置类型 ───────────────────────────────────────────────

/** 广告位配置项 */
export interface IAdUnitConfig {
    /** 广告类型 */
    type: AdType;
    /** 广告位 ID（各平台提供的广告位标识） */
    adUnitId: string;
    /** Banner 样式（仅 Banner 广告需要） */
    bannerStyle?: IBannerStyle;
}

/**
 * 广告系统配置
 *
 * 使用示例：
 * ```ts
 * const config: IAdConfig = {
 *     adUnits: {
 *         revive: { type: AdType.RewardedVideo, adUnitId: 'xxx' },
 *         mainBanner: { type: AdType.Banner, adUnitId: 'yyy', bannerStyle: { width: 300, height: 80 } },
 *         gameOver: { type: AdType.Interstitial, adUnitId: 'zzz' },
 *     }
 * };
 * AdManager.getInstance().init(config);
 * ```
 */
export interface IAdConfig {
    /** 广告位映射表，key 为业务自定义名称（如 'revive'、'mainBanner'） */
    adUnits: Record<string, IAdUnitConfig>;
}
