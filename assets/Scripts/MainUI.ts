import { _decorator, Button, Node, director } from 'cc';
import { UIPanel } from './UI/UIPanel';
import { UIFrame } from './UI/UIFrame';

const { ccclass } = _decorator;

/**
 * 主界面UI - 在main场景中使用
 * 通过 UIFrame 管理面板生命周期
 * 继承 UIPanel，预制体路径通过 UIFrame.registerPrefab 注册
 */
@ccclass('MainUI')
export class MainUI extends UIPanel {

    private _starting = false;

    protected onPanelInit(): void {
        const startBtn = this.node.getChildByName('StartBtn');
        if (!startBtn) {
            console.error('[MainUI] 未找到 StartBtn 节点');
            return;
        }

        startBtn.on(Node.EventType.TOUCH_END, () => {
            if (this._starting) return;
            this._starting = true;

            const button = startBtn.getComponent(Button);
            if (button) {
                button.interactable = false;
            }

            // UIFrame 是持久化节点，切场景前先立即隐藏并清空面板栈，避免主界面残留到 battle。
            this.node.active = false;
            UIFrame.getInstance().closeAll();
            director.loadScene('battle');
        });
    }
}
