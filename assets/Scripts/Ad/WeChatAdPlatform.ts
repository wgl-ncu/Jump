/**
 * 微信小游戏广告平台实现
 *
 * 封装 wx.createRewardedVideoAd / wx.createBannerAd / wx.createInterstitialAd
 * 将微信原生广告对象适配为平台无关的 IAdPlatform 接口。
 */

import { IAdPlatform } from './IAdPlatform';
import {
    IRewardedVideoAd, IBannerAd, IInterstitialAd,
    IBannerStyle, IAdError,
} from './AdTypes';

// ─── 微信广告原生类型声明（最小集） ────────────────────────────

interface WxRewardedVideoAd {
    show(): Promise<void>;
    load(): Promise<void>;
    destroy(): void;
    onClose(callback: (res: { isEnded: boolean }) => void): void;
    offClose(callback: (res: { isEnded: boolean }) => void): void;
    onError(callback: (err: { errCode: number; errMsg: string }) => void): void;
    offError(callback: (err: { errCode: number; errMsg: string }) => void): void;
    onLoad(callback: () => void): void;
    offLoad(callback: () => void): void;
}

interface WxBannerAd {
    show(): Promise<void>;
    hide(): void;
    destroy(): void;
    style: { width: number; height: number; top: number; left: number; realWidth?: number; realHeight?: number };
    onError(callback: (err: { errCode: number; errMsg: string }) => void): void;
    offError(callback: (err: { errCode: number; errMsg: string }) => void): void;
    onLoad(callback: () => void): void;
    offLoad(callback: () => void): void;
    onResize(callback: (size: { width: number; height: number }) => void): void;
    offResize(callback: (size: { width: number; height: number }) => void): void;
}

interface WxInterstitialAd {
    show(): Promise<void>;
    load(): Promise<void>;
    destroy(): void;
    onClose(callback: () => void): void;
    offClose(callback: () => void): void;
    onError(callback: (err: { errCode: number; errMsg: string }) => void): void;
    offError(callback: (err: { errCode: number; errMsg: string }) => void): void;
    onLoad(callback: () => void): void;
    offLoad(callback: () => void): void;
}

interface WxAdNamespace {
    createRewardedVideoAd(options: { adUnitId: string }): WxRewardedVideoAd;
    createBannerAd(options: { adUnitId: string; style: { width?: number; height?: number; top?: number; left?: number } }): WxBannerAd;
    createInterstitialAd(options: { adUnitId: string }): WxInterstitialAd;
}

// ─── 适配器实现 ──────────────────────────────────────────────

/** 微信激励视频广告适配器 */
class WxRewardedVideoAdAdapter implements IRewardedVideoAd {
    private _native: WxRewardedVideoAd;
    public onClose: ((isEnded: boolean) => void) | null = null;
    public onError: ((err: IAdError) => void) | null = null;
    public onLoad: (() => void) | null = null;

    private _onCloseHandler: ((res: { isEnded: boolean }) => void) | null = null;
    private _onErrorHandler: ((err: { errCode: number; errMsg: string }) => void) | null = null;
    private _onLoadHandler: (() => void) | null = null;

    constructor(native: WxRewardedVideoAd) {
        this._native = native;
        this._bindEvents();
    }

    private _bindEvents() {
        this._onCloseHandler = (res) => this.onClose?.(res.isEnded);
        this._onErrorHandler = (err) => this.onError?.({ errCode: err.errCode, errMsg: err.errMsg });
        this._onLoadHandler = () => this.onLoad?.();
        this._native.onClose(this._onCloseHandler);
        this._native.onError(this._onErrorHandler);
        this._native.onLoad(this._onLoadHandler);
    }

    show(): Promise<void> { return this._native.show(); }
    load(): Promise<void> { return this._native.load(); }
    destroy(): void {
        if (this._onCloseHandler) this._native.offClose(this._onCloseHandler);
        if (this._onErrorHandler) this._native.offError(this._onErrorHandler);
        if (this._onLoadHandler) this._native.offLoad(this._onLoadHandler);
        this._native.destroy();
    }
}

/** 微信 Banner 广告适配器 */
class WxBannerAdAdapter implements IBannerAd {
    private _native: WxBannerAd;
    public onError: ((err: IAdError) => void) | null = null;
    public onLoad: (() => void) | null = null;
    public onResize: ((size: { width: number; height: number }) => void) | null = null;

    private _onErrorHandler: ((err: { errCode: number; errMsg: string }) => void) | null = null;
    private _onLoadHandler: (() => void) | null = null;
    private _onResizeHandler: ((size: { width: number; height: number }) => void) | null = null;

    constructor(native: WxBannerAd) {
        this._native = native;
        this._bindEvents();
    }

    private _bindEvents() {
        this._onErrorHandler = (err) => this.onError?.({ errCode: err.errCode, errMsg: err.errMsg });
        this._onLoadHandler = () => this.onLoad?.();
        this._onResizeHandler = (size) => this.onResize?.(size);
        this._native.onError(this._onErrorHandler);
        this._native.onLoad(this._onLoadHandler);
        this._native.onResize(this._onResizeHandler);
    }

    get style(): IBannerStyle {
        return this._native.style;
    }

    set style(value: IBannerStyle) {
        if (value.width !== undefined) this._native.style.width = value.width;
        if (value.height !== undefined) this._native.style.height = value.height;
        if (value.top !== undefined) this._native.style.top = value.top;
        if (value.left !== undefined) this._native.style.left = value.left;
    }

    show(): Promise<void> { return this._native.show(); }
    hide(): void { this._native.hide(); }
    destroy(): void {
        if (this._onErrorHandler) this._native.offError(this._onErrorHandler);
        if (this._onLoadHandler) this._native.offLoad(this._onLoadHandler);
        if (this._onResizeHandler) this._native.offResize(this._onResizeHandler);
        this._native.destroy();
    }
}

/** 微信插屏广告适配器 */
class WxInterstitialAdAdapter implements IInterstitialAd {
    private _native: WxInterstitialAd;
    public onClose: (() => void) | null = null;
    public onError: ((err: IAdError) => void) | null = null;
    public onLoad: (() => void) | null = null;

    private _onCloseHandler: (() => void) | null = null;
    private _onErrorHandler: ((err: { errCode: number; errMsg: string }) => void) | null = null;
    private _onLoadHandler: (() => void) | null = null;

    constructor(native: WxInterstitialAd) {
        this._native = native;
        this._bindEvents();
    }

    private _bindEvents() {
        this._onCloseHandler = () => this.onClose?.();
        this._onErrorHandler = (err) => this.onError?.({ errCode: err.errCode, errMsg: err.errMsg });
        this._onLoadHandler = () => this.onLoad?.();
        this._native.onClose(this._onCloseHandler);
        this._native.onError(this._onErrorHandler);
        this._native.onLoad(this._onLoadHandler);
    }

    show(): Promise<void> { return this._native.show(); }
    load(): Promise<void> { return this._native.load(); }
    destroy(): void {
        if (this._onCloseHandler) this._native.offClose(this._onCloseHandler);
        if (this._onErrorHandler) this._native.offError(this._onErrorHandler);
        if (this._onLoadHandler) this._native.offLoad(this._onLoadHandler);
        this._native.destroy();
    }
}

// ─── 平台实现 ────────────────────────────────────────────────

/**
 * 微信小游戏广告平台
 *
 * 自动检测 wx 环境是否可用。
 * 使用方式：
 * ```ts
 * const platform = new WeChatAdPlatform();
 * if (platform.isSupported()) {
 *     adManager.setPlatform(platform);
 * }
 * ```
 */
export class WeChatAdPlatform implements IAdPlatform {
    readonly platformName = 'wechat';
    private _wx: WxAdNamespace | null = null;

    constructor() {
        this._detectWx();
    }

    private _detectWx() {
        // 在微信小游戏环境中，wx 是全局对象
        const g = globalThis as any;
        if (typeof g.wx !== 'undefined' && g.wx.createRewardedVideoAd) {
            this._wx = g.wx as WxAdNamespace;
        }
    }

    isSupported(): boolean {
        return this._wx !== null;
    }

    createRewardedVideoAd(adUnitId: string): IRewardedVideoAd {
        if (!this._wx) throw new Error('[WeChatAdPlatform] wx environment not available');
        const native = this._wx.createRewardedVideoAd({ adUnitId });
        return new WxRewardedVideoAdAdapter(native);
    }

    createBannerAd(adUnitId: string, style?: IBannerStyle): IBannerAd {
        if (!this._wx) throw new Error('[WeChatAdPlatform] wx environment not available');
        const bannerStyle = {
            width: style?.width ?? 300,
            height: style?.height ?? 80,
            top: style?.top ?? 0,
            left: style?.left ?? 0,
        };
        const native = this._wx.createBannerAd({ adUnitId, style: bannerStyle });
        return new WxBannerAdAdapter(native);
    }

    createInterstitialAd(adUnitId: string): IInterstitialAd {
        if (!this._wx) throw new Error('[WeChatAdPlatform] wx environment not available');
        const native = this._wx.createInterstitialAd({ adUnitId });
        return new WxInterstitialAdAdapter(native);
    }
}
