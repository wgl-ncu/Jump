import { _decorator, Button, Label } from 'cc';
import { UIPanel } from './UI/UIPanel';

const { ccclass } = _decorator;

@ccclass('GameOverUI')
export class GameOverUI extends UIPanel {

    private _finalScoreLabel: Label | null = null;
    private _bestScoreLabel: Label | null = null;
    private _restartButton: Button | null = null;
    private _backButton: Button | null = null;

    protected onPanelInit(): void {
        this._finalScoreLabel = this.getComponentAt('TopPart/CurPoint', Label);
        this._bestScoreLabel = this.getComponentAt('TopPart/RecordPoint', Label);
        this._restartButton = this.getComponentAt('BtnGroup/OnceAgain', Button);
        this._backButton = this.getComponentAt('BtnGroup/BackToMainBtn', Button);
        this.node.active = false;
    }

    public getFinalScoreLabel(): Label | null {
        return this._finalScoreLabel;
    }

    public getBestScoreLabel(): Label | null {
        return this._bestScoreLabel;
    }

    public getRestartButton(): Button | null {
        return this._restartButton;
    }

    public getBackButton(): Button | null {
        return this._backButton;
    }
}
