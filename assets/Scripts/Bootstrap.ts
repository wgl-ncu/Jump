import { _decorator, Component, director, Director, view, ResolutionPolicy, log, Node, UITransform, Size, Canvas, Widget } from 'cc';
import { SceneBuilder } from './SceneBuilder';
import { GameManager } from './GameManager';
import { MainUI } from './MainUI';
const { ccclass } = _decorator;

/**
 * 游戏引导入口 - 根据场景名区分初始化逻辑
 * main场景：显示主界面
 * battle场景：构建游戏场景
 */
@ccclass('Bootstrap')
export class Bootstrap extends Component {

    start() {
        const sceneName = director.getScene()?.name || '';
        log('[Bootstrap] 当前场景:', sceneName);

        // 设置设计分辨率（竖屏 720x1280）
        view.setDesignResolutionSize(720, 1280, ResolutionPolicy.SHOW_ALL);

        // 确保 Canvas 有必要的组件
        this.ensureCanvasComponents();

        if (sceneName === 'main') {
            this.initMainScene();
        } else if (sceneName === 'battle') {
            this.initBattleScene();
        } else {
            // 默认按battle场景处理
            this.initBattleScene();
        }
    }

    /**
     * 初始化主界面场景
     */
    private initMainScene() {
        log('[Bootstrap] 初始化主界面...');
        this.node.addComponent(MainUI);
    }

    /**
     * 初始化战斗场景
     */
    private initBattleScene() {
        log('[Bootstrap] 初始化战斗场景...');

        // 添加场景构建器
        const sceneBuilder = this.node.addComponent(SceneBuilder);

        // 添加游戏管理器
        const gameManager = this.node.addComponent(GameManager);

        // 等待场景构建完成后绑定引用
        this.scheduleOnce(() => {
            const player = sceneBuilder.getPlayer();
            const spawner = sceneBuilder.getObstacleSpawner();
            const ui = sceneBuilder.getUIManager();
            const field = sceneBuilder.getMagneticField();

            log('[Bootstrap] 绑定组件引用:', {
                player: !!player,
                spawner: !!spawner,
                ui: !!ui,
                field: !!field
            });

            gameManager.setPlayer(player);
            gameManager.setObstacleSpawner(spawner);
            gameManager.setUIManager(ui);
            gameManager.setMagneticField(field);
        }, 0.3);
    }

    private ensureCanvasComponents() {
        let canvas = this.node.getComponent(Canvas);
        if (!canvas) {
            canvas = this.node.addComponent(Canvas);
            log('[Bootstrap] 添加 Canvas 组件');
        }

        let uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.node.addComponent(UITransform);
            log('[Bootstrap] 添加 UITransform 组件');
        }
        uiTransform.setContentSize(new Size(720, 1280));

        let widget = this.node.getComponent(Widget);
        if (!widget) {
            widget = this.node.addComponent(Widget);
            log('[Bootstrap] 添加 Widget 组件');
        }
    }
}

/**
 * 自动初始化 - 每次场景加载时在 Canvas 上添加 Bootstrap 组件
 */
director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => {
    const scene = director.getScene();
    if (!scene) return;

    const findCanvas = (node: Node): Node | null => {
        if (node.getComponent(Canvas)) return node;
        for (const child of node.children) {
            const found = findCanvas(child);
            if (found) return found;
        }
        return null;
    };

    const canvasNode = findCanvas(scene);
    if (!canvasNode) return;

    // 避免重复添加
    if (canvasNode.getComponent(Bootstrap)) return;

    log('[Bootstrap] 自动初始化：在 Canvas 上添加 Bootstrap 组件');
    canvasNode.addComponent(Bootstrap);
});
