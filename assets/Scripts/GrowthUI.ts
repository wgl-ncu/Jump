import { _decorator, Button, Color, instantiate, Label, Node, ScrollView, Sprite, UITransform } from 'cc';
import { GrowthManager, GrowthUpgradeState } from './GrowthManager';
import { UIPanel } from './UI/UIPanel';
import { UIFrame, UILayer } from './UI/UIFrame';

const { ccclass } = _decorator;

type UpgradeEntryRefs = {
    id: number;
    root: Node;
    icon: Sprite | null;
    content: Label | null;
    level: Label | null;
    button: Node;
    buttonLabel: Label | null;
};

@ccclass('GrowthUI')
export class GrowthUI extends UIPanel {
    private _goldLabel: Label | null = null;
    private _titleLabel: Label | null = null;
    private _tipLabel: Label | null = null;
    private _closeButton: Node | null = null;
    private _scrollView: ScrollView | null = null;
    private _contentNode: Node | null = null;
    private _templateItem: Node | null = null;
    private _entries: UpgradeEntryRefs[] = [];

    protected get layer(): UILayer {
        return UILayer.Panel;
    }

    protected get cacheable(): boolean {
        return false;
    }

    protected onPanelInit(): void {
        this.preparePrefabLayout();
        this.createHeaderNodes();
        this.buildEntries();
        this.refreshView();
    }

    protected onPanelOpen(data?: any): void {
        super.onPanelOpen(data);
        this._scrollView?.scrollToTop(0);
        this.refreshView();
    }

    private preparePrefabLayout(): void {
        this._scrollView = this.getComponentAt('Area/ScrollView', ScrollView);
        this._contentNode = this.find('Area/ScrollView/view/content');
        this._templateItem = this.find('Area/ScrollView/view/content/item');

        if (!this._scrollView || !this._contentNode || !this._templateItem) {
            console.error('[GrowthUI] prefab 结构不完整，缺少 ScrollView/content/item');
            return;
        }

        this._templateItem.active = false;
        this._contentNode.removeAllChildren();
        this._contentNode.addChild(this._templateItem);
    }

    private createHeaderNodes(): void {
        const areaNode = this.find('Area');
        if (!areaNode) {
            return;
        }

        const blocker = new Node('Blocker');
        blocker.setParent(this.node);
        blocker.setSiblingIndex(0);
        blocker.addComponent(UITransform).setContentSize(720, 1280);
        blocker.on(Node.EventType.TOUCH_START, () => undefined, this);
        blocker.on(Node.EventType.TOUCH_MOVE, () => undefined, this);
        blocker.on(Node.EventType.TOUCH_END, () => undefined, this);

        this._titleLabel = this.createLabel('Title', this.node, '成长系统', 34, new Color(255, 245, 220, 255), 0, 430, 400, 42);
        this._goldLabel = this.createLabel('Gold', this.node, '', 26, new Color(255, 224, 120, 255), -120, 390, 260, 34);
        this._tipLabel = this.createLabel('Tip', this.node, '局内金币在结算时转为局外金币。', 20, new Color(188, 203, 226, 255), 0, -420, 520, 30);
        this._tipLabel.enableWrapText = true;

        this._closeButton = new Node('CloseButton');
        this._closeButton.setParent(this.node);
        this._closeButton.setPosition(250, 400, 0);
        this._closeButton.addComponent(UITransform).setContentSize(110, 46);
        const closeSprite = this._closeButton.addComponent(Sprite);
        closeSprite.color = new Color(69, 87, 122, 255);
        this._closeButton.addComponent(Button);
        const closeLabel = this.createLabel('Label', this._closeButton, '返回', 22, new Color(255, 255, 255, 255), 0, 0, 90, 28);
        this._closeButton.on(Node.EventType.TOUCH_END, this.handleCloseClicked, this);
        closeLabel.node.on(Node.EventType.TOUCH_END, this.handleCloseClicked, this);

        areaNode.setSiblingIndex(1);
    }

    private buildEntries(): void {
        if (!this._contentNode || !this._templateItem) {
            return;
        }

        this._entries = [];

        const states = GrowthManager.getInstance().getAllUpgradeStates();
        const templateTransform = this._templateItem.getComponent(UITransform);
        const contentTransform = this._contentNode.getComponent(UITransform);
        const templateY = this._templateItem.position.y;
        const templateX = this._templateItem.position.x;
        const rowHeight = (templateTransform?.contentSize.height ?? 80) + 12;

        states.forEach((state, index) => {
            const root = instantiate(this._templateItem!);
            root.name = `item_${state.definition.Id}`;
            root.active = true;
            root.setParent(this._contentNode!);
            root.setPosition(templateX, templateY - index * rowHeight, 0);

            const button = root.getChildByName('UpBtn');
            const buttonLabel = root.getChildByPath('UpBtn/Label')?.getComponent(Label) ?? null;
            const icon = root.getChildByName('Icon')?.getComponent(Sprite) ?? null;
            const content = root.getChildByName('Content')?.getComponent(Label) ?? null;
            const level = root.getChildByName('Lv')?.getComponent(Label) ?? null;

            button?.on(Node.EventType.TOUCH_END, () => this.handleUpgradeClicked(state.definition.Id), this);
            buttonLabel?.node.on(Node.EventType.TOUCH_END, () => this.handleUpgradeClicked(state.definition.Id), this);

            this._entries.push({
                id: state.definition.Id,
                root,
                icon,
                content,
                level,
                button: button ?? root,
                buttonLabel,
            });
        });

        if (contentTransform) {
            const minHeight = this._scrollView?.node.getComponent(UITransform)?.contentSize.height ?? 728;
            const topInset = Math.max(0, -templateY);
            const calculatedHeight = topInset + states.length * rowHeight + 24;
            contentTransform.setContentSize(contentTransform.contentSize.width, Math.max(minHeight, calculatedHeight));
        }
    }

    private handleCloseClicked(): void {
        this.closeSelf();
    }

    private handleUpgradeClicked(upgradeId: number): void {
        const growthManager = GrowthManager.getInstance();
        const state = growthManager.getUpgradeState(upgradeId);
        if (!state) {
            return;
        }

        if (!state.unlocked) {
            UIFrame.getInstance().toast('该成长尚未解锁');
            return;
        }

        if (!growthManager.canUpgrade(upgradeId)) {
            UIFrame.getInstance().toast(state.level >= state.maxLevel ? '已达到最高等级' : '金币不足');
            return;
        }

        if (!growthManager.upgrade(upgradeId)) {
            UIFrame.getInstance().toast('升级失败');
            return;
        }

        UIFrame.getInstance().toast(`${state.definition.Name} 升级成功`);
        this.refreshView();
    }

    private refreshView(): void {
        const growthManager = GrowthManager.getInstance();
        if (this._goldLabel) {
            this._goldLabel.string = `金币 ${growthManager.getGoldText()}`;
        }

        for (const entry of this._entries) {
            const state = growthManager.getUpgradeState(entry.id);
            if (!state) {
                continue;
            }

            if (entry.content) {
                const currentText = growthManager.getDisplayValueText(state, state.currentValue);
                const nextText = state.nextValue != null ? growthManager.getDisplayValueText(state, state.nextValue) : null;
                entry.content.string = nextText
                    ? `${state.definition.Name}  ${currentText}->${nextText}`
                    : `${state.definition.Name}  ${currentText}`;
                entry.content.color = state.unlocked ? new Color(78, 78, 78, 255) : new Color(128, 128, 128, 255);
            }

            if (entry.level) {
                entry.level.string = `Lv. ${state.level}/${state.maxLevel}`;
                entry.level.color = state.unlocked ? new Color(78, 78, 78, 255) : new Color(128, 128, 128, 255);
            }

            if (entry.icon) {
                entry.icon.color = state.unlocked ? new Color(255, 255, 255, 255) : new Color(150, 150, 150, 255);
            }

            const buttonSprite = entry.button.getComponent(Sprite);
            const buttonComp = entry.button.getComponent(Button);

            if (!state.unlocked) {
                entry.buttonLabel && (entry.buttonLabel.string = '未解锁');
                if (buttonSprite) {
                    buttonSprite.color = new Color(170, 170, 170, 255);
                }
                if (buttonComp) {
                    buttonComp.interactable = false;
                }
                continue;
            }

            if (state.level >= state.maxLevel) {
                entry.buttonLabel && (entry.buttonLabel.string = '已满级');
                if (buttonSprite) {
                    buttonSprite.color = new Color(170, 170, 170, 255);
                }
                if (buttonComp) {
                    buttonComp.interactable = false;
                }
                continue;
            }

            const canUpgrade = growthManager.canUpgrade(entry.id);
            entry.buttonLabel && (entry.buttonLabel.string = `升级 ${GrowthManager.formatScaledValue(state.upgradeCostGold || 0)}`);
            if (buttonSprite) {
                buttonSprite.color = canUpgrade ? new Color(255, 255, 255, 255) : new Color(210, 210, 210, 255);
            }
            if (buttonComp) {
                buttonComp.interactable = canUpgrade;
            }
        };
    }

    private createLabel(name: string, parent: Node, text: string, fontSize: number, color: Color, x: number, y: number, width: number, height: number): Label {
        const node = new Node(name);
        node.setParent(parent);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.color = color;
        return label;
    }
}