/**
 * GameEvents - 游戏事件定义
 *
 * 通过 TypeScript 的 declare module 扩展 EventBus 的 EventMap，
 * 使 EventBus.on / EventBus.emit 获得完整的类型推断和检查。
 *
 * 命名规范：
 * - 使用 `领域:动作` 格式，如 `player:switchPole`
 * - 载荷类型紧随其后定义
 *
 * 新增事件只需在此文件添加两处：
 * 1. 在 GameEventMap 接口中添加事件名 => 载荷类型
 * 2. 如果载荷非原始类型，在上方定义载荷 interface
 */

/** ========= 载荷类型定义 ========= */

/** 玩家磁极切换 */
export interface PoleChangePayload {
    pole: import('../Player').MagneticPole;
}

/** 分数变化 */
export interface ScoreChangePayload {
    score: number;
    delta: number;
}

/** 生命值变化 */
export interface LivesChangePayload {
    lives: number;
    maxLives: number;
}

/** 无敌状态变化 */
export interface InvinciblePayload {
    active: boolean;
    duration: number;
}

/** 冲刺状态变化 */
export interface DashPayload {
    active: boolean;
    duration: number;
}

/** 奖励房间状态变化 */
export interface BonusRoomPayload {
    active: boolean;
    timeLeft: number;
}

/** 磁场状态 */
export interface MagneticFieldPayload {
    reversalFactor: number;
}

/** 游戏状态变化 */
export type GameStatePayload = 'ready' | 'playing' | 'gameover';

/** ========= 事件映射表 ========= */

export interface GameEventMap {
    // ---- 游戏生命周期 ----
    /** 游戏开始 */
    'game:start': undefined;
    /** 游戏重启 */
    'game:restart': undefined;
    /** 游戏结束 */
    'game:over': undefined;
    /** 游戏状态变化 */
    'game:stateChange': GameStatePayload;

    // ---- 玩家事件 ----
    /** 磁极切换 */
    'player:switchPole': PoleChangePayload;
    /** 玩家受伤 */
    'player:hurt': LivesChangePayload;
    /** 玩家死亡 */
    'player:die': undefined;
    /** 无敌状态变化 */
    'player:invincible': InvinciblePayload;
    /** 冲刺状态变化 */
    'player:dash': DashPayload;
    /** 击飞冲刺 */
    'player:knockbackDash': undefined;
    /** 进入奖励房间 */
    'player:enterBonusRoom': undefined;
    /** 退出奖励房间 */
    'player:exitBonusRoom': undefined;

    // ---- 分数事件 ----
    /** 分数变化 */
    'score:change': ScoreChangePayload;

    // ---- 生命值事件 ----
    /** 生命值变化 */
    'lives:change': LivesChangePayload;

    // ---- 磁场事件 ----
    /** 磁场反转状态 */
    'magnetic:fieldStatus': MagneticFieldPayload;

    // ---- 奖励房间 ----
    /** 奖励房间状态变化 */
    'bonusRoom:change': BonusRoomPayload;

    // ---- UI 事件 ----
    /** 显示开始面板 */
    'ui:showStart': undefined;
    /** 显示结束面板 */
    'ui:showGameOver': undefined;
    /** 隐藏所有面板 */
    'ui:hideAll': undefined;
    /** Toast 消息 */
    'ui:toast': { message: string; duration?: number };
}

/**
 * 将 GameEventMap 注册到 EventBus 的全局 EventMap
 * 这样 EventBus.on / EventBus.emit 就能获得类型检查
 */
declare module './EventBus' {
    interface EventMap extends GameEventMap { }
}
