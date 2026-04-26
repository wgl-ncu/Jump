import { _decorator, Button, Label, Node, ScrollView } from 'cc';
import { UIPanel } from './UI/UIPanel';
import { UILayer } from './UI/UIFrame';

const { ccclass } = _decorator;

@ccclass('BattleUI')
export class BattleUI extends UIPanel {

    private _scoreLabel: Label | null = null;
    private _poleNIcon: Node | null = null;
    private _poleSIcon: Node | null = null;
    private _livesScrollView: ScrollView | null = null;

    protected get layer(): UILayer {
        return UILayer.HUD;
    }

    protected onPanelInit(): void {
        this._scoreLabel = this.getComponentAt('Top/Point', Label);
        this._poleNIcon = this.find('Top/NSTip/N');
        this._poleSIcon = this.find('Top/NSTip/S');
        this._livesScrollView = this.getComponentAt('Top/Heart/HeartsSV', ScrollView);
    }

    protected playOpenAnimation(): void {
        this.node.active = true;
    }

    protected playCloseAnimation(): void {
        this.node.active = false;
    }

    public getScoreLabel(): Label | null {
        return this._scoreLabel;
    }

    public getPoleNIcon(): Node | null {
        return this._poleNIcon;
    }

    public getPoleSIcon(): Node | null {
        return this._poleSIcon;
    }

    public getLivesScrollView(): ScrollView | null {
        return this._livesScrollView;
    }
}
