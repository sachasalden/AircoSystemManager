import {
  createStateKey,
  sameNumericValue,
  type SyncProperty,
  type Zone,
} from './SyncTypes';

type EchoEntry = {
  value: number;
  expiresAt: number;
};

export default class SyncEchoGuard {
  private entries = new Map<string, EchoEntry>();

  constructor(private ttlMs = 15000) {}

  remember(
    deviceId: string,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): void {
    this.entries.set(createStateKey(deviceId, unitId, zone, property), {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  consumeIfExpected(
    deviceId: string,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): boolean {
    const key = createStateKey(deviceId, unitId, zone, property);
    const entry = this.entries.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return false;
    }

    if (!sameNumericValue(entry.value, value)) {
      return false;
    }

    this.entries.delete(key);
    return true;
  }

  cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt < now) {
        this.entries.delete(key);
      }
    }
  }
}
