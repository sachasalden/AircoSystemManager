import {
  createDeviceStateKey,
  sameNumericValue,
  type SyncOrigin,
  type SyncProperty,
  type Zone,
} from './SyncTypes';

type EchoEntry = {
  value: number;
  expiresAt: number;
};

export default class SyncEchoGuard {
  private expectedStates = new Map<string, EchoEntry>();

  constructor(private ttlMs = 15000) {}

  expectEcho(
    origin: SyncOrigin,
    deviceId: string,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): void {
    const key = createDeviceStateKey(origin, deviceId, unitId, zone, property);
    this.expectedStates.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  consumeExpectedEcho(
    origin: SyncOrigin,
    deviceId: string,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): boolean {
    const key = createDeviceStateKey(origin, deviceId, unitId, zone, property);
    const entry = this.expectedStates.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expiresAt < Date.now()) {
      this.expectedStates.delete(key);
      return false;
    }

    if (!sameNumericValue(entry.value, value)) {
      return false;
    }

    this.expectedStates.delete(key);
    return true;
  }
}
