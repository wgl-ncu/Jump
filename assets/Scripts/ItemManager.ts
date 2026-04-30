import { sys } from 'cc';

export enum MetaItemId {
    GuardianWing = 'guardianWing',
    RapidDash = 'rapidDash',
}

interface ItemStorageData {
    inventory?: Partial<Record<MetaItemId, number>>;
}

export interface MetaItemDefinition {
    id: MetaItemId;
    name: string;
    description: string;
}

export class ItemManager {

    private static readonly STORAGE_KEY = 'magneticJump_itemState';

    private static readonly DEFINITIONS: Record<MetaItemId, MetaItemDefinition> = {
        [MetaItemId.GuardianWing]: {
            id: MetaItemId.GuardianWing,
            name: '守护之翼',
            description: '本局首次受到致命伤时立即满血复活，并立刻获得一次冲刺道具效果。',
        },
        [MetaItemId.RapidDash]: {
            id: MetaItemId.RapidDash,
            name: '急速冲刺',
            description: '开局立即获得 8 秒强化冲刺，冲刺速度为局内冲刺道具的 2 倍，其他效果保持一致。',
        },
    };

    private static _instance: ItemManager | null = null;

    private _inventory: Record<MetaItemId, number> = {
        [MetaItemId.GuardianWing]: 0,
        [MetaItemId.RapidDash]: 0,
    };

    private _usedInCurrentRun: Set<MetaItemId> = new Set();
    private _loaded = false;

    public static getInstance(): ItemManager {
        if (!ItemManager._instance) {
            ItemManager._instance = new ItemManager();
        }
        return ItemManager._instance;
    }

    private constructor() {
        this.ensureLoaded();
    }

    public getDefinition(itemId: MetaItemId): MetaItemDefinition {
        return ItemManager.DEFINITIONS[itemId];
    }

    public getOwnedCount(itemId: MetaItemId): number {
        this.ensureLoaded();
        return this._inventory[itemId] || 0;
    }

    public addItem(itemId: MetaItemId, amount: number = 1): number {
        this.ensureLoaded();

        const actualAmount = Math.floor(amount);
        if (actualAmount <= 0) {
            return this.getOwnedCount(itemId);
        }

        this._inventory[itemId] = this.getOwnedCount(itemId) + actualAmount;
        this.saveState();
        return this._inventory[itemId];
    }

    public startRun(): void {
        this.ensureLoaded();
        this._usedInCurrentRun.clear();
    }

    public canTriggerInCurrentRun(itemId: MetaItemId): boolean {
        this.ensureLoaded();
        return this.getOwnedCount(itemId) > 0 && !this._usedInCurrentRun.has(itemId);
    }

    public tryConsumeForCurrentRun(itemId: MetaItemId): boolean {
        this.ensureLoaded();
        if (!this.canTriggerInCurrentRun(itemId)) {
            return false;
        }

        this._inventory[itemId] = Math.max(0, this.getOwnedCount(itemId) - 1);
        this._usedInCurrentRun.add(itemId);
        this.saveState();
        return true;
    }

    private ensureLoaded(): void {
        if (this._loaded) return;
        this._loaded = true;

        const raw = sys.localStorage.getItem(ItemManager.STORAGE_KEY);
        if (!raw) {
            this.saveState();
            return;
        }

        try {
            const parsed = JSON.parse(raw) as ItemStorageData;
            const inventory = parsed.inventory || {};

            for (const itemId of Object.values(MetaItemId)) {
                const count = Number(inventory[itemId]);
                this._inventory[itemId] = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
            }
        } catch {
            this._inventory = {
                [MetaItemId.GuardianWing]: 0,
                [MetaItemId.RapidDash]: 0,
            };
            this.saveState();
        }
    }

    private saveState(): void {
        const data: ItemStorageData = {
            inventory: this._inventory,
        };
        sys.localStorage.setItem(ItemManager.STORAGE_KEY, JSON.stringify(data));
    }
}