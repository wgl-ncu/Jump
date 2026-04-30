import { _decorator, Component, director, Director, view, ResolutionPolicy, log, warn, error, Node } from 'cc';
import { AdManager, AdType, MockAdPlatform } from './Ad';
import { SceneBuilder } from './SceneBuilder';
import { GameManager } from './GameManager';
import { UIFrame } from './UI/UIFrame';
import { DataManager } from './Data/DataManager';
import { CocosDataProvider } from './Data/CocosDataProvider';
import './GrowthUI';
const { ccclass } = _decorator;

/** 已知场景名 */
enum SceneName {
    Main = 'main',
    Battle = 'battle',
}

/** 战斗场景根节点名（用于查重） */
const BATTLE_ROOT_NAME = '[Battle]';

/** 设计分辨率（竖屏） */
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

/**
 * 游戏引导入口 - 持久化单例，监听场景变化处理初始化
 *
 * 自动创建持久化节点，无需手动挂载到场景。
 * 根据场景名分发初始化逻辑：
 * - main 场景：显示主界面
 * - battle 场景：构建游戏场景（SceneBuilder + GameManager 自行装配引用）
 */
@ccclass('Bootstrap')
export class Bootstrap extends Component {

    private static readonly TAG = '[Bootstrap]';
    private static _instance: Bootstrap | null = null;

    /** 防止 onLoad 重复执行（持久化节点理论上只走一次，加保险） */
    private _bootstrapped = false;

    public static getInstance(): Bootstrap | null {
        return Bootstrap._instance;
    }

    async onLoad() {
        if (Bootstrap._instance && Bootstrap._instance !== this) {
            warn(`${Bootstrap.TAG} 检测到重复实例，销毁后加载的节点`);
            this.node.destroy();
            return;
        }

        Bootstrap._instance = this;
        director.addPersistRootNode(this.node);

        if (this._bootstrapped) return;
        this._bootstrapped = true;

        // 设置设计分辨率
        view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);

        // 加载配置数据（失败则中止后续初始化，避免业务在缺数据情况下崩溃）
        const ok = await this.loadConfigData();
        if (!ok) return;

        // 编辑器 / 浏览器预览下初始化 Mock 广告，便于直接调试激励流程。
        this.initAds();

        // 注册 UI 预制体
        this.registerPrefabs();

        // 处理当前场景（首次进入时手动派发一次）
        this.handleScene(director.getScene()?.name);

        // 监听后续场景切换
        director.on(Director.EVENT_AFTER_SCENE_LAUNCH, this.onSceneLaunched, this);
    }

    private async loadConfigData(): Promise<boolean> {
        const dm = DataManager.getInstance();
        if (dm.isLoaded) return true;

        try {
            await dm.load(new CocosDataProvider());
            log(`${Bootstrap.TAG} 配置数据加载完成`);
            return true;
        } catch (err) {
            error(`${Bootstrap.TAG} 配置数据加载失败:`, err);
            return false;
        }
    }

    private initAds(): void {
        const wxApi = (globalThis as any).wx;
        const isWeChatMiniGame = typeof wxApi?.createRewardedVideoAd === 'function';
        if (isWeChatMiniGame) {
            return;
        }

        AdManager.getInstance().init({
            adUnits: {
                power: {
                    type: AdType.RewardedVideo,
                    adUnitId: 'mock-rewarded-power',
                },
                revive: {
                    type: AdType.RewardedVideo,
                    adUnitId: 'mock-rewarded-revive',
                },
            },
        }, new MockAdPlatform());

        log(`${Bootstrap.TAG} 非微信环境已切换到 MockAdPlatform`);
    }

    private registerPrefabs() {
        UIFrame.getInstance().registerPrefab('MainUI', 'Prefabs/UI/MainUI');
        UIFrame.getInstance().registerPrefab('BattleUI', 'Prefabs/UI/BattleUI');
        UIFrame.getInstance().registerPrefab('GameOverUI', 'Prefabs/UI/GameOverUI');
        UIFrame.getInstance().registerPrefab('CommonPopUI', 'Prefabs/UI/CommonPopUI');
        UIFrame.getInstance().registerPrefab('GrowthUI', 'Prefabs/UI/GrowthUI');
    }

    private onSceneLaunched = () => {
        this.handleScene(director.getScene()?.name);
    };

    private handleScene(sceneName: string | undefined) {
        if (!sceneName) return;
        log(`${Bootstrap.TAG} 场景切换:`, sceneName);

        switch (sceneName) {
            case SceneName.Main:
                this.initMainScene();
                break;
            case SceneName.Battle:
                this.initBattleScene();
                break;
            default:
                // 未识别场景，不做处理
                break;
        }
    }

    private initMainScene() {
        log(`${Bootstrap.TAG} 初始化主界面`);
        UIFrame.getInstance().closeAll();
        UIFrame.getInstance().open('MainUI');
    }

    private initBattleScene() {
        const scene = director.getScene();
        if (!scene) return;

        const rootParent = scene.getChildByName('Canvas') ?? scene;

        // 防止同一战斗场景重复构建
        if (rootParent.getChildByName(BATTLE_ROOT_NAME)) {
            warn(`${Bootstrap.TAG} 战斗根节点已存在，跳过重复构建`);
            return;
        }

        log(`${Bootstrap.TAG} 初始化战斗场景`);
        UIFrame.getInstance().closeAll();

        // 优先挂到场景现有 Canvas 下，复用正确的屏幕坐标系。
        const gameRoot = new Node(BATTLE_ROOT_NAME);
        rootParent.addChild(gameRoot);

        // SceneBuilder 异步构建场景；GameManager.start() 内部会轮询等待 SceneBuilder
        // 完成构建后自行获取并绑定 player / spawner / ui / field 等引用，
        // 因此这里无需在 Bootstrap 中再做引用装配。
        gameRoot.addComponent(SceneBuilder);
        gameRoot.addComponent(GameManager);
    }

    onDestroy() {
        // 持久化根节点正常情况下不会销毁，这里只是保险清理
        director.off(Director.EVENT_AFTER_SCENE_LAUNCH, this.onSceneLaunched, this);
        if (Bootstrap._instance === this) {
            Bootstrap._instance = null;
        }
    }
}
