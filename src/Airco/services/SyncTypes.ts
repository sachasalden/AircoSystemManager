export type Zone = 1 | 2;

export type SyncProperty =
  | 'setpoint'
  | 'virtualTemperature'
  | 'fanSpeed'
  | 'fanMode';

export type SyncOrigin = 'panel' | 'airco';

export type SyncMessage = {
  schema: 'aircotest.sync.v1';
  origin: SyncOrigin;
  zoneId: string;
  roomId: string;
  deviceId: string;
  unitId: number;
  zone: Zone;
  property: SyncProperty;
  value: number;
  timestamp: string;
};

export const SYNC_PROPERTIES: readonly SyncProperty[] = Object.freeze([
  'setpoint',
  'virtualTemperature',
  'fanSpeed',
  'fanMode',
]);

export function createDeviceStateKey(
  origin: SyncOrigin,
  deviceId: string,
  unitId: number,
  zone: Zone,
  property: SyncProperty,
): string {
  return `${origin}:${deviceId}:${unitId}:${zone}:${property}`;
}

export function sameNumericValue(a: number, b: number, tolerance = 0.05): boolean {
  return Math.abs(a - b) <= tolerance;
}
