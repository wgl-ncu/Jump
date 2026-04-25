/**
 * 广告管理器
 *
 * 核心职责：
 * 1. 自动检测运行平台并选择对应的广告实现
 * 2. 通过配置统一管理所有广告位
 * 3. 缓存广告实例，避免重复创建
 * 4. 提供简洁的 Promise 式 API，上层无需关心平台差异
 *
 * 快速上手：
 * ```ts
 * // 1. 初始化（游戏启动时调用一次）
 * AdManager.getInstance().init({
 *     adUnits: {
 *         revive:      { type: AdType.RewardedVideo, adUnitId: 'your-ad-unit-id' },
 *         mainBanner:  { type: AdType.Banner, adUnitId: 'your-ad-unit-id', bannerStyle: { width: 300, height: 80 } },
 *         gameOver:    { type: AdType.Interstitial, adUnitId: 'your-ad-unit-id' },
 *     }
 * });
 *
 * // 2. 展示激励视频（用户看完返回 true）
 * const watched = await AdManager.getInstance().showRewardedVideo('revive');
 * if (watched) { grantReward(); }
 *
 * // 3. 展示 / 隐藏 Banner
 * await AdManager.getInstance().showBanner('mainBanner');
 * AdManager.getInstance().hideBanner('mainBanner');
 *
 * // 4. 展示插屏广告
 * await AdManager.getInstance().showInterstitial('gameOver');
 * ```
 */

import { IAdPlatform } from './IAdPlatform';
import {
    AdType, IAdConfig, IAdUnitConfig,
    IRewardedVideoAd, IBannerAd, IInterstitialAd,
    IBannerStyle,
} from './AdTypes';
import { WeChatAdPlatform } from './WeChatAdPlatform';
import { MockAdPlatform } from './MockAdPlatform';

export class AdManager {
    private static _instance: AdManager | null = null;

    /** 当前广告平台 */
    private _platform: IAdPlatform | null = null;

    /** 广告位配置映射表 */
    private _adUnitConfigs: Map<string, IAdUnitConfig> = new Map();

    /** 已创建的激励视频广告实例缓存 */
    private _rewardedVideoAds: Map<string, IRewardedVideoAd> = new Map();

    /** 已创建的 Banner 广告实例缓存 */
    private _bannerAds: Map<string, IBannerAd> = new Map();

    /** 已创建的插屏广告实例缓存 */
    private _interstitialAds: Map<string, IInterstitialAd> = new Map();

    /** 是否已初始化 */
    private _initialized = false;

    /** 是否启用广告（可用于付费去广告等场景） */
    private _enabled = true;

    private constructor() {}

    /** 获取单例 */
    static getInstance(): AdManager {
        if (!AdManager._instance) {
            AdManager._instance = new AdManager();
        }
        return AdManager._instance;
    }

    /** 销毁单例（通常只在测试中使用） */
    static destroyInstance(): void {
        if (AdManager._instance) {
            AdManager._instance.destroyAll();
            AdManager._instance = null;
        }
    }

    /** 当前平台名称 */
    get platformName(): string {
        return this._platform?.platformName ?? 'none';
    }

    /** 是否已初始化 */
    get isInitialized(): boolean {
        return this._initialized;
    }

    /** 是否启用广告 */
    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
        if (!value) {
            this.hideAllBanners();
        }
    }

    // ─── 初始化 ──────────────────────────────────────────────

    /**
     * 初始化广告系统
     *
     * @param config 广告配置
     * @param platform 可选，手动指定广告平台；不传则自动检测
     *
     * 自动检测逻辑：
     * 1. 优先检测微信小游戏环境
     * 2. 未检测到任何平台时，回退到 Mock 平台（开发/调试用）
     */
    init(config: IAdConfig, platform?: IAdPlatform): void {
        // 注册配置
        this._adUnitConfigs.clear();
        for (const [key, unitConfig] of Object.entries(config.adUnits)) {
            this._adUnitConfigs.set(key, unitConfig);
        }

        // 清理旧广告实例
        this.destroyAll();

        // 设置平台
        if (platform) {
            this._platform = platform;
        } else {
            this._platform = this._autoDetectPlatform();
        }

        this._initialized = true;
        console.log(`[AdManager] initialized, platform: ${this._platform.platformName}, ad units: [${Array.from(this._adUnitConfigs.keys()).join(', ')}]`);
    }

    /**
     * 手动设置广告平台（用于后续扩展新平台）
     */
    setPlatform(platform: IAdPlatform): void {
        this.destroyAll();
        this._platform = platform;
        console.log(`[AdManager] platform set to: ${platform.platformName}`);
    }

    /**
     * 自动检测运行平台
     */
    private _autoDetectPlatform(): IAdPlatform {
        // 检测微信小游戏
        const wechat = new WeChatAdPlatform();
        if (wechat.isSupported()) {
            console.log('[AdManager] detected WeChat Mini Game environment');
            return wechat;
        }

        // 回退到 Mock 平台
        console.log('[AdManager] no ad platform detected, using MockAdPlatform');
        return new MockAdPlatform();
    }

    // ─── 激励视频 ────────────────────────────────────────────

    /**
     * 展示激励视频广告（便捷方法）
     *
     * @param key 配置中的广告位 key
     * @returns Promise<boolean> - 用户是否看完广告
     *
     * 此方法会：
     * 1. 自动创建/复用广告实例
     * 2. 广告未加载时自动加载
     * 3. 展示广告并等待用户关闭
     * 4. 返回用户是否看完广告
     */
    showRewardedVideo(key: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this._enabled || !this._platform) {
                console.warn('[AdManager] ads disabled or platform not initialized');
                resolve(false);
                return;
            }

            const config = this._adUnitConfigs.get(key);
            if (!config || config.type !== AdType.RewardedVideo) {
                console.warn(`[AdManager] no RewardedVideo ad unit for key: ${key}`);
                resolve(false);
                return;
            }

            const ad = this._getOrCreateRewardedVideo(key, config.adUnitId);

            ad.onClose = (isEnded: boolean) => {
                ad.onClose = null;
                resolve(isEnded);
            };

            ad.onError = (err) => {
                ad.onError = null;
                console.warn(`[AdManager] RewardedVideo error for key "${key}":`, err);
                resolve(false);
            };

            ad.show().catch((e) => {
                // 展示失败，尝试先加载再展示
                console.log(`[AdManager] RewardedVideo show failed, try load then show:`, e);
                ad.load().then(() => ad.show()).catch(() => {
                    ad.onClose = null;
                    ad.onError = null;
                    resolve(false);
                });
            });
        });
    }

    /**
     * 获取激励视频广告实例（用于更细粒度的控制）
     */
    getRewardedVideoAd(key: string): IRewardedVideoAd | null {
        if (!this._platform) return null;
        const config = this._adUnitConfigs.get(key);
        if (!config || config.type !== AdType.RewardedVideo) return null;
        return this._getOrCreateRewardedVideo(key, config.adUnitId);
    }

    /**
     * 预加载激励视频广告
     */
    preloadRewardedVideo(key: string): Promise<void> {
        const ad = this.getRewardedVideoAd(key);
        if (!ad) return Promise.resolve();
        return ad.load().catch(() => {});
    }

    private _getOrCreateRewardedVideo(key: string, adUnitId: string): IRewardedVideoAd {
        let ad = this._rewardedVideoAds.get(key);
        if (!ad) {
            ad = this._platform!.createRewardedVideoAd(adUnitId);
            this._rewardedVideoAds.set(key, ad);
        }
        return ad;
    }

    // ─── Banner ──────────────────────────────────────────────

    /**
     * 展示 Banner 广告
     */
    showBanner(key: string, style?: IBannerStyle): Promise<void> {
        if (!this._enabled || !this._platform) {
            return Promise.resolve();
        }

        const config = this._adUnitConfigs.get(key);
        if (!config || config.type !== AdType.Banner) {
            console.warn(`[AdManager] no Banner ad unit for key: ${key}`);
            return Promise.resolve();
        }

        const ad = this._getOrCreateBanner(key, config.adUnitId, style ?? config.bannerStyle);
        return ad.show().catch((e) => {
            console.warn(`[AdManager] Banner show error for key "${key}":`, e);
        });
    }

    /**
     * 隐藏 Banner 广告
     */
    hideBanner(key: string): void {
        const ad = this._bannerAds.get(key);
        if (ad) {
            ad.hide();
        }
    }

    /**
     * 隐藏所有 Banner 广告
     */
    hideAllBanners(): void {
        for (const ad of this._bannerAds.values()) {
            ad.hide();
        }
    }

    /**
     * 获取 Banner 广告实例
     */
    getBannerAd(key: string): IBannerAd | null {
        return this._bannerAds.get(key) ?? null;
    }

    private _getOrCreateBanner(key: string, adUnitId: string, style?: IBannerStyle): IBannerAd {
        let ad = this._bannerAds.get(key);
        if (!ad) {
            ad = this._platform!.createBannerAd(adUnitId, style);
            this._bannerAds.set(key, ad);
        } else if (style) {
            // 更新样式
            ad.style = style;
        }
        return ad;
    }

    // ─── 插屏 ────────────────────────────────────────────────

    /**
     * 展示插屏广告（便捷方法）
     *
     * @returns Promise<boolean> - 广告是否成功展示并正常关闭
     */
    showInterstitial(key: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this._enabled || !this._platform) {
                resolve(false);
                return;
            }

            const config = this._adUnitConfigs.get(key);
            if (!config || config.type !== AdType.Interstitial) {
                console.warn(`[AdManager] no Interstitial ad unit for key: ${key}`);
                resolve(false);
                return;
            }

            const ad = this._getOrCreateInterstitial(key, config.adUnitId);

            ad.onClose = () => {
                ad.onClose = null;
                resolve(true);
            };

            ad.onError = (err) => {
                ad.onError = null;
                console.warn(`[AdManager] Interstitial error for key "${key}":`, err);
                resolve(false);
            };

            ad.show().catch((e) => {
                console.log(`[AdManager] Interstitial show failed, try load then show:`, e);
                ad.load().then(() => ad.show()).catch(() => {
                    ad.onClose = null;
                    ad.onError = null;
                    resolve(false);
                });
            });
        });
    }

    /**
     * 获取插屏广告实例
     */
    getInterstitialAd(key: string): IInterstitialAd | null {
        if (!this._platform) return null;
        const config = this._adUnitConfigs.get(key);
        if (!config || config.type !== AdType.Interstitial) return null;
        return this._getOrCreateInterstitial(key, config.adUnitId);
    }

    /**
     * 预加载插屏广告
     */
    preloadInterstitial(key: string): Promise<void> {
        const ad = this.getInterstitialAd(key);
        if (!ad) return Promise.resolve();
        return ad.load().catch(() => {});
    }

    private _getOrCreateInterstitial(key: string, adUnitId: string): IInterstitialAd {
        let ad = this._interstitialAds.get(key);
        if (!ad) {
            ad = this._platform!.createInterstitialAd(adUnitId);
            this._interstitialAds.set(key, ad);
        }
        return ad;
    }

    // ─── 生命周期管理 ────────────────────────────────────────

    /**
     * 销毁指定广告位的广告实例
     */
    destroyAd(key: string): void {
        const rewarded = this._rewardedVideoAds.get(key);
        if (rewarded) {
            rewarded.destroy();
            this._rewardedVideoAds.delete(key);
            return;
        }

        const banner = this._bannerAds.get(key);
        if (banner) {
            banner.destroy();
            this._bannerAds.delete(key);
            return;
        }

        const interstitial = this._interstitialAds.get(key);
        if (interstitial) {
            interstitial.destroy();
            this._interstitialAds.delete(key);
        }
    }

    /**
     * 销毁所有广告实例
     */
    destroyAll(): void {
        for (const ad of this._rewardedVideoAds.values()) ad.destroy();
        for (const ad of this._bannerAds.values()) ad.destroy();
        for (const ad of this._interstitialAds.values()) ad.destroy();
        this._rewardedVideoAds.clear();
        this._bannerAds.clear();
        this._interstitialAds.clear();
    }
}
