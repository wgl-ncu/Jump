/**
 * Mock 广告平台实现
 *
 * 用于浏览器/编辑器环境下的开发调试。
 * 模拟广告加载、展示和关闭的全流程，通过控制台输出日志。
 */

import { IAdPlatform } from './IAdPlatform';
import {
    IRewardedVideoAd, IBannerAd, IInterstitialAd,
    IBannerStyle, IAdError,
} from './AdTypes';

/** Mock 延迟时间（毫秒），模拟广告加载 */
const MOCK_LOAD_DELAY = 500;
/** Mock 展示延迟（毫秒），模拟广告展示 */
const MOCK_SHOW_DELAY = 1000;
/** Mock 观看时长（毫秒），模拟用户看完广告 */
const MOCK_WATCH_DURATION = 2000;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Mock 激励视频广告 */
class MockRewardedVideoAd implements IRewardedVideoAd {
    public onClose: ((isEnded: boolean) => void) | null = null;
    public onError: ((err: IAdError) => void) | null = null;
    public onLoad: (() => void) | null = null;

    private _loaded = false;
    private _showing = false;

    constructor(private _adUnitId: string) {}

    async load(): Promise<void> {
        console.log(`[MockAd] RewardedVideo load() - adUnitId: ${this._adUnitId}`);
        await delay(MOCK_LOAD_DELAY);
        this._loaded = true;
        this.onLoad?.();
        console.log(`[MockAd] RewardedVideo loaded`);
    }

    async show(): Promise<void> {
        if (!this._loaded) {
            await this.load();
        }
        console.log(`[MockAd] RewardedVideo show() - adUnitId: ${this._adUnitId}`);
        this._showing = true;
        await delay(MOCK_SHOW_DELAY);

        // 模拟用户观看广告
        setTimeout(() => {
            if (this._showing) {
                this._showing = false;
                const isEnded = true; // Mock 默认看完
                console.log(`[MockAd] RewardedVideo closed, isEnded: ${isEnded}`);
                this.onClose?.(isEnded);
            }
        }, MOCK_WATCH_DURATION);
    }

    destroy(): void {
        this._showing = false;
        this._loaded = false;
        console.log(`[MockAd] RewardedVideo destroy()`);
    }
}

/** Mock Banner 广告 */
class MockBannerAd implements IBannerAd {
    public onError: ((err: IAdError) => void) | null = null;
    public onLoad: (() => void) | null = null;
    public onResize: ((size: { width: number; height: number }) => void) | null = null;

    public style: IBannerStyle;
    private _visible = false;

    constructor(private _adUnitId: string, style?: IBannerStyle) {
        this.style = {
            width: style?.width ?? 300,
            height: style?.height ?? 80,
            top: style?.top ?? 0,
            left: style?.left ?? 0,
        };
    }

    async show(): Promise<void> {
        console.log(`[MockAd] Banner show() - adUnitId: ${this._adUnitId}`);
        await delay(MOCK_LOAD_DELAY);
        this._visible = true;
        this.onLoad?.();
        console.log(`[MockAd] Banner shown, style:`, this.style);
    }

    hide(): void {
        console.log(`[MockAd] Banner hide()`);
        this._visible = false;
    }

    destroy(): void {
        this._visible = false;
        console.log(`[MockAd] Banner destroy()`);
    }
}

/** Mock 插屏广告 */
class MockInterstitialAd implements IInterstitialAd {
    public onClose: (() => void) | null = null;
    public onError: ((err: IAdError) => void) | null = null;
    public onLoad: (() => void) | null = null;

    private _loaded = false;
    private _showing = false;

    constructor(private _adUnitId: string) {}

    async load(): Promise<void> {
        console.log(`[MockAd] Interstitial load() - adUnitId: ${this._adUnitId}`);
        await delay(MOCK_LOAD_DELAY);
        this._loaded = true;
        this.onLoad?.();
        console.log(`[MockAd] Interstitial loaded`);
    }

    async show(): Promise<void> {
        if (!this._loaded) {
            await this.load();
        }
        console.log(`[MockAd] Interstitial show() - adUnitId: ${this._adUnitId}`);
        this._showing = true;
        await delay(MOCK_SHOW_DELAY);

        setTimeout(() => {
            if (this._showing) {
                this._showing = false;
                console.log(`[MockAd] Interstitial closed`);
                this.onClose?.();
            }
        }, MOCK_WATCH_DURATION);
    }

    destroy(): void {
        this._showing = false;
        this._loaded = false;
        console.log(`[MockAd] Interstitial destroy()`);
    }
}

/**
 * Mock 广告平台
 *
 * 始终返回 isSupported() = true，方便在非小游戏环境中调试。
 */
export class MockAdPlatform implements IAdPlatform {
    readonly platformName = 'mock';

    isSupported(): boolean {
        return true;
    }

    createRewardedVideoAd(adUnitId: string): IRewardedVideoAd {
        return new MockRewardedVideoAd(adUnitId);
    }

    createBannerAd(adUnitId: string, style?: IBannerStyle): IBannerAd {
        return new MockBannerAd(adUnitId, style);
    }

    createInterstitialAd(adUnitId: string): IInterstitialAd {
        return new MockInterstitialAd(adUnitId);
    }
}
