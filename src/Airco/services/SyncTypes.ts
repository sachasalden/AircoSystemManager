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

export type PanelStateMessage = {
  schema: 'aircotest.panel-state.v1';
  sourceInstanceId: string;
  timestamp: string;
  zoneId: string;
  roomId: string;
  panelId: string;
  unitId: number;
  zone: Zone;
  setpoint?: number;
  virtualTemperature?: number;
  fanSpeed?: number;
  fanMode?: number;
};

export type TopologyRoom = {
  zoneId: string;
  roomId: string;
  roomName: string;
  panels: PanelDevice[];
  aircos: AircoDevice[];
};

export type PanelDevice = {
  id: string;
  ip: string;
  port: number;
  ids: number[];
  type?: string;
};

export type AircoDevice = {
  id: string;
  deviceType?: string;
  setTemperature?: number;
  currentTemperature?: number;
  data?: Record<string, any>;
  environmentDevice?: EnvironmentDevice;
};

export type EnvironmentDevice = {
  id: string;
  name: string;
  type: string;
  ip: string;
  port: number;
  bidirectional: boolean;
};

export const SYNC_PROPERTIES = [
  'setpoint',
  'virtualTemperature',
  'fanSpeed',
  'fanMode',
] as const satisfies readonly SyncProperty[];

export const PANEL_TO_AIRCO_PROPERTIES = [
  'setpoint',
  'fanSpeed',
  'fanMode',
] as const satisfies readonly SyncProperty[];

export const AIRCO_TO_PANEL_PROPERTIES = [
  'setpoint',
  'virtualTemperature',
  'fanSpeed',
  'fanMode',
] as const satisfies readonly SyncProperty[];

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
