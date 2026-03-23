export type Zone = 1 | 2;

export type SyncProperty =
  | 'setpoint'
  | 'virtualTemperature'
  | 'fanSpeed'
  | 'fanMode';

export type SyncOrigin = 'panel' | 'airco';

export type SyncMessage = {
  schema: 'aircotest.sync.v4';
  messageId: string;
  sourceInstanceId: string;
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

export type TopologyRoom = {
  zoneId: string;
  roomId: string;
  roomName: string;
  panels: Array<{
    id: string;
    ip: string;
    port: number;
    ids: number[];
    type?: string;
  }>;
  aircos: Array<{
    id: string;
    deviceType?: string;
    data?: Record<string, any>;
  }>;
};

export const SYNC_PROPERTIES: readonly SyncProperty[] = Object.freeze([
  'setpoint',
  'virtualTemperature',
  'fanSpeed',
  'fanMode',
]);

export const PANEL_TO_AIRCO_PROPERTIES: readonly SyncProperty[] = Object.freeze(
  ['setpoint', 'fanSpeed', 'fanMode'],
);

export const AIRCO_TO_PANEL_PROPERTIES: readonly SyncProperty[] = Object.freeze(
  ['virtualTemperature', 'fanSpeed', 'fanMode'],
);

export function createStateKey(
  deviceId: string,
  unitId: number,
  zone: Zone,
  property: SyncProperty,
): string {
  return `${deviceId}:${unitId}:${zone}:${property}`;
}

export function sameNumericValue(
  a: number,
  b: number,
  tolerance = 0.05,
): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
