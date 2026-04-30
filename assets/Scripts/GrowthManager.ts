import { sys } from 'cc';
import { DataManager } from './Data/DataManager';
import { goldeconomy, growthupgrade, growthupgradelevel } from './Data/schema/schema';
import { ItemManager, MetaItemId } from './ItemManager';

export interface GrowthUpgradeState {
    definition: growthupgrade.GrowthUpgrade;
    level: number;
    maxLevel: number;
    unlocked: boolean;
    currentValue: number;
    nextValue: number | null;
    upgradeCostGold: number | null;
}

interface GrowthStorageData {
    goldScaled?: number;
    levels?: Record<string, number>;
}

export class GrowthManager {
    private static readonly STORAGE_KEY = 'magneticJump_growthState';

    private static readonly BASE_VALUES: Record<string, number> = {
        dash_duration: 45,
        invincible_duration: 80,
        bonus_room_duration: 90,
        pickup_radius: 650,
        gold_multiplier: 1000,
        rapid_dash_duration: 70,
    };

    private static _instance: GrowthManager | null = null;

    private _loaded = false;
    private _goldScaled = 0;
    private _levels = new Map<number, number>();

    public static getInstance(): GrowthManager {
        if (!GrowthManager._instance) {
            GrowthManager._instance = new GrowthManager();
        }
        return GrowthManager._instance;
    }

    private constructor() {
        this.ensureLoaded();
    }

    public static formatScaledValue(value: number): string {
        const integerPart = Math.trunc(value / 10);
        const fractionPart = Math.abs(value % 10);
        return fractionPart === 0 ? `${integerPart}` : `${integerPart}.${fractionPart}`;
    }

    public getGoldScaled(): number {
        this.ensureLoaded();
        return this._goldScaled;
    }

    public getGoldText(): string {
        return GrowthManager.formatScaledValue(this.getGoldScaled());
    }

    public addGoldScaled(amount: number): number {
        this.ensureLoaded();
        const safeAmount = Math.max(0, Math.floor(amount));
        if (safeAmount <= 0) {
            return this._goldScaled;
        }

        this._goldScaled += safeAmount;
        this.saveState();
        return this._goldScaled;
    }

    public calculateRunGoldScaled(coinScore: number): number {
        const safeCoinScore = Math.max(0, Math.floor(coinScore));
        if (safeCoinScore <= 0) {
            return 0;
        }

        const economy = this.getGoldEconomy();
        const scale = economy?.DataScale || 10;
        const baseGoldScaled = safeCoinScore * scale;
        const goldMultiplier = this.getScaledValueByKey('gold_multiplier');
        return Math.floor(baseGoldScaled * goldMultiplier / 1000);
    }

    public settleRunGold(coinScore: number): number {
        const goldScaled = this.calculateRunGoldScaled(coinScore);
        this.addGoldScaled(goldScaled);
        return goldScaled;
    }

    public claimDoubleReward(baseGoldScaled: number): number {
        return this.addGoldScaled(baseGoldScaled);
    }

    public getDoubleAdNormalThreshold(): number {
        return this.getGoldEconomy()?.DoubleAdNormalThreshold || 120;
    }

    public getDoubleAdStrongThreshold(): number {
        return this.getGoldEconomy()?.DoubleAdStrongThreshold || 240;
    }

    public getUpgradeDefinitions(): growthupgrade.GrowthUpgrade[] {
        const table = this.getUpgradeTable();
        if (!table) {
            return [];
        }

        return table.getDataList().slice().sort((left, right) => left.DisplayOrder - right.DisplayOrder);
    }

    public getUpgradeLevel(upgradeId: number): number {
        this.ensureLoaded();
        return this._levels.get(upgradeId) || 0;
    }

    public getUpgradeState(upgradeId: number): GrowthUpgradeState | null {
        const definition = this.getUpgradeTable()?.get(upgradeId);
        if (!definition) {
            return null;
        }

        const level = this.getUpgradeLevel(upgradeId);
        const records = this.getLevelRecords(upgradeId);
        const currentRecord = level > 0 ? records.find((record) => record.Level === level) || null : null;
        const nextRecord = level < definition.MaxLevel ? records.find((record) => record.Level === level + 1) || null : null;

        return {
            definition,
            level,
            maxLevel: definition.MaxLevel,
            unlocked: this.isUpgradeUnlocked(definition),
            currentValue: currentRecord?.Value ?? this.getBaseScaledValue(definition.Key),
            nextValue: nextRecord?.Value ?? null,
            upgradeCostGold: nextRecord?.CostGold ?? null,
        };
    }

    public getAllUpgradeStates(): GrowthUpgradeState[] {
        return this.getUpgradeDefinitions()
            .map((definition) => this.getUpgradeState(definition.Id))
            .filter((state): state is GrowthUpgradeState => !!state);
    }

    public canUpgrade(upgradeId: number): boolean {
        const state = this.getUpgradeState(upgradeId);
        if (!state || !state.unlocked || state.level >= state.maxLevel || state.upgradeCostGold == null) {
            return false;
        }

        return this._goldScaled >= state.upgradeCostGold;
    }

    public upgrade(upgradeId: number): boolean {
        const state = this.getUpgradeState(upgradeId);
        if (!state || !this.canUpgrade(upgradeId) || state.upgradeCostGold == null) {
            return false;
        }

        this._goldScaled -= state.upgradeCostGold;
        this._levels.set(upgradeId, state.level + 1);
        this.saveState();
        return true;
    }

    public isUpgradeUnlocked(definition: growthupgrade.GrowthUpgrade): boolean {
        switch (definition.UnlockCondition) {
            case 'default':
                return true;
            case 'reach_any_two_lv3':
                return this.getUpgradeDefinitions().filter((item) => this.getUpgradeLevel(item.Id) >= 3).length >= 2;
            case 'own_meta_item_rapid_dash':
                return this.getUpgradeLevel(definition.Id) > 0
                    || ItemManager.getInstance().getOwnedCount(MetaItemId.RapidDash) > 0;
            default:
                return true;
        }
    }

    public getScaledValueByKey(key: string): number {
        const definition = this.getUpgradeDefinitions().find((item) => item.Key === key);
        if (!definition) {
            return this.getBaseScaledValue(key);
        }

        const state = this.getUpgradeState(definition.Id);
        return state?.currentValue ?? this.getBaseScaledValue(key);
    }

    public getDisplayValueText(state: GrowthUpgradeState, value: number): string {
        switch (state.definition.ValueType) {
            case 'duration':
                return `${GrowthManager.formatScaledValue(value)}s`;
            case 'radius':
                return `${GrowthManager.formatScaledValue(value)}`;
            case 'percent':
                return `${GrowthManager.formatScaledValue(value)}%`;
            default:
                return GrowthManager.formatScaledValue(value);
        }
    }

    private getBaseScaledValue(key: string): number {
        return GrowthManager.BASE_VALUES[key] ?? 0;
    }

    private getGoldEconomy(): goldeconomy.GoldEconomy | null {
        return this.getGoldEconomyTable()?.get(1) || null;
    }

    private getGoldEconomyTable(): goldeconomy.TbGoldEconomy | null {
        return DataManager.getInstance().tables?.TbGoldEconomy || null;
    }

    private getUpgradeTable(): growthupgrade.TbGrowthUpgrade | null {
        return DataManager.getInstance().tables?.TbGrowthUpgrade || null;
    }

    private getUpgradeLevelTable(): growthupgradelevel.TbGrowthUpgradeLevel | null {
        return DataManager.getInstance().tables?.TbGrowthUpgradeLevel || null;
    }

    private getLevelRecords(upgradeId: number): growthupgradelevel.GrowthUpgradeLevel[] {
        const table = this.getUpgradeLevelTable();
        if (!table) {
            return [];
        }

        return table.getDataList()
            .filter((record) => record.UpgradeId === upgradeId)
            .sort((left, right) => left.Level - right.Level);
    }

    private ensureLoaded(): void {
        if (this._loaded) {
            return;
        }

        this._loaded = true;
        const raw = sys.localStorage.getItem(GrowthManager.STORAGE_KEY);
        if (!raw) {
            this.saveState();
            return;
        }

        try {
            const parsed = JSON.parse(raw) as GrowthStorageData;
            this._goldScaled = Math.max(0, Math.floor(Number(parsed.goldScaled) || 0));

            const levels = parsed.levels || {};
            for (const [upgradeId, level] of Object.entries(levels)) {
                const numericId = Number(upgradeId);
                const numericLevel = Math.max(0, Math.floor(Number(level) || 0));
                if (Number.isFinite(numericId) && numericLevel > 0) {
                    this._levels.set(numericId, numericLevel);
                }
            }
        } catch {
            this._goldScaled = 0;
            this._levels.clear();
            this.saveState();
        }
    }

    private saveState(): void {
        const levels: Record<string, number> = {};
        for (const [upgradeId, level] of this._levels.entries()) {
            levels[String(upgradeId)] = level;
        }

        const data: GrowthStorageData = {
            goldScaled: this._goldScaled,
            levels,
        };
        sys.localStorage.setItem(GrowthManager.STORAGE_KEY, JSON.stringify(data));
    }
}