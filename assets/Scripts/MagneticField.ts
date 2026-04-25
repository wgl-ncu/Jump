import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

/**
 * 磁场逻辑 - 纵向卷轴版
 * 左侧为N极，右侧为S极
 */
@ccclass('MagneticField')
export class MagneticField extends Component {

    /** 分界线X位置 */
    private _dividerX: number = 0;

    /** 当前反转系数 */
    private _reversalFactor: number = 0;

    public init(dividerX: number = 0) {
        this._dividerX = dividerX;
    }

    /**
     * 设置反转系数
     */
    public setReversalFactor(factor: number) {
        this._reversalFactor = factor;
    }

    public getDividerX(): number {
        return this._dividerX;
    }

    public getReversalFactor(): number {
        return this._reversalFactor;
    }
}
