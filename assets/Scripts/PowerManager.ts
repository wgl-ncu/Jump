import { sys } from 'cc';

interface PowerStorageData {
    currentPower: number;
    lastRecoveryCheckMs: number;
}

export interface PowerState {
    currentPower: number;
    naturalRecoveryLimit: number;
    nextRecoveryTimestampMs: number | null;
}

export class PowerManager {

    public static readonly INITIAL_POWER = 30;
    public static readonly NATURAL_RECOVERY_LIMIT = 30;
    public static readonly GAME_START_COST = 5;
    public static readonly RECOVERY_INTERVAL_MS = 3 * 60 * 1000;

    private static readonly STORAGE_KEY = 'magneticJump_powerState';
    private static _instance: PowerManager | null = null;

    private _currentPower = PowerManager.INITIAL_POWER;
    private _lastRecoveryCheckMs = 0;
    private _loaded = false;

    public static getInstance(): PowerManager {
        if (!PowerManager._instance) {
            PowerManager._instance = new PowerManager();
        }
        return PowerManager._instance;
    }

    private constructor() {
        this.ensureLoaded();
    }

    public getState(): PowerState {
        this.ensureLoaded();
        this.refreshState(Date.now());

        return {
            currentPower: this._currentPower,
            naturalRecoveryLimit: PowerManager.NATURAL_RECOVERY_LIMIT,
            nextRecoveryTimestampMs: this._currentPower < PowerManager.NATURAL_RECOVERY_LIMIT
                ? this._lastRecoveryCheckMs + PowerManager.RECOVERY_INTERVAL_MS
                : null,
        };
    }

    public canStartGame(cost: number = PowerManager.GAME_START_COST): boolean {
        this.ensureLoaded();
        this.refreshState(Date.now());
        return this._currentPower >= Math.max(0, cost);
    }

    public tryConsumeForGame(cost: number = PowerManager.GAME_START_COST): boolean {
        this.ensureLoaded();

        const actualCost = Math.max(0, cost);
        const now = Date.now();
        this.refreshState(now);

        if (this._currentPower < actualCost) {
            return false;
        }

        this._currentPower -= actualCost;
        this._lastRecoveryCheckMs = now;
        this.saveState();
        return true;
    }

    public addPower(amount: number): number {
        this.ensureLoaded();

        const actualAmount = Math.floor(amount);
        if (actualAmount <= 0) {
            return this._currentPower;
        }

        const now = Date.now();
        this.refreshState(now);
        this._currentPower += actualAmount;

        if (this._currentPower >= PowerManager.NATURAL_RECOVERY_LIMIT) {
            this._lastRecoveryCheckMs = now;
        }

        this.saveState();
        return this._currentPower;
    }

    private ensureLoaded(): void {
        if (this._loaded) return;
        this._loaded = true;

        const now = Date.now();
        const raw = sys.localStorage.getItem(PowerManager.STORAGE_KEY);
        if (!raw) {
            this.resetToDefaults(now);
            this.saveState();
            return;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<PowerStorageData>;
            const currentPower = Number(parsed.currentPower);
            const lastRecoveryCheckMs = Number(parsed.lastRecoveryCheckMs);

            if (!Number.isFinite(currentPower) || !Number.isFinite(lastRecoveryCheckMs)) {
                throw new Error('invalid power storage');
            }

            this._currentPower = Math.max(0, Math.floor(currentPower));
            this._lastRecoveryCheckMs = Math.max(0, Math.floor(lastRecoveryCheckMs));
            this.refreshState(now);
        } catch {
            this.resetToDefaults(now);
            this.saveState();
        }
    }

    private refreshState(now: number): void {
        if (this._currentPower >= PowerManager.NATURAL_RECOVERY_LIMIT) {
            return;
        }

        const safeNow = Math.max(now, this._lastRecoveryCheckMs);
        const elapsedMs = safeNow - this._lastRecoveryCheckMs;
        const recovered = Math.floor(elapsedMs / PowerManager.RECOVERY_INTERVAL_MS);
        if (recovered <= 0) {
            return;
        }

        this._currentPower += recovered;

        if (this._currentPower >= PowerManager.NATURAL_RECOVERY_LIMIT) {
            this._currentPower = PowerManager.NATURAL_RECOVERY_LIMIT;
            this._lastRecoveryCheckMs = safeNow;
        } else {
            this._lastRecoveryCheckMs += recovered * PowerManager.RECOVERY_INTERVAL_MS;
        }

        this.saveState();
    }

    private resetToDefaults(now: number): void {
        this._currentPower = PowerManager.INITIAL_POWER;
        this._lastRecoveryCheckMs = now;
    }

    private saveState(): void {
        const data: PowerStorageData = {
            currentPower: this._currentPower,
            lastRecoveryCheckMs: this._lastRecoveryCheckMs,
        };
        sys.localStorage.setItem(PowerManager.STORAGE_KEY, JSON.stringify(data));
    }
}