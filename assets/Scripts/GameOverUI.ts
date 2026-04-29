import { _decorator, Button, Label } from 'cc';
import { UIPanel } from './UI/UIPanel';

const { ccclass } = _decorator;

@ccclass('GameOverUI')
export class GameOverUI extends UIPanel {

    private static readonly ROOT_PATHS = ['BG', ''];

    private _finalScoreLabel: Label | null = null;
    private _bestScoreLabel: Label | null = null;
    private _restartButton: Button | null = null;
    private _backButton: Button | null = null;

    protected onPanelInit(): void {
        this._finalScoreLabel = this.getComponentFromPaths('TopPart/CurPoint', Label);
        this._bestScoreLabel = this.getComponentFromPaths('TopPart/RecordPoint', Label);
        this._restartButton = this.getComponentFromPaths('BtnGroup/OnceAgain', Button);
        this._backButton = this.getComponentFromPaths('BtnGroup/BackToMainBtn', Button);
        this.node.active = false;
    }

    private getComponentFromPaths<T>(relativePath: string, type: new (...args: any[]) => T): T | null {
        for (const rootPath of GameOverUI.ROOT_PATHS) {
            const fullPath = rootPath ? `${rootPath}/${relativePath}` : relativePath;
            const component = this.getComponentAt(fullPath, type);
            if (component) {
                return component;
            }
        }

        return null;
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
