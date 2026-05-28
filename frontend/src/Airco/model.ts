export type WallpanelVersion = 'polarbear-v1' | 'polarbear-v2' | 'polarbear-v3';

export type WallpanelUnit = {
  id: number;
  type: WallpanelVersion;
  name?: string;
};

export type EnvironmentDevice = {
  id: string;
  name: string;
  type: string;
  ip: string;
  port: string;
  bidirectional: boolean;
};

export type WallpanelDevice = {
  id: string;
  name?: string;
  ip: string;
  version?: WallpanelVersion;
  port: number;
  terminalIds?: number[];
  modbusUnits?: WallpanelUnit[];
  zoneId?: string;
  roomId?: string;
  ids?: number[];
  type?: string;
};

export type AirconditionerDevice = {
  id: string;
  name?: string;
  deviceType: string;
  minTemperature: number;
  maxTemperature: number;
  minSetTemperature: number;
  maxSetTemperature: number;
  setTemperature: number;
  currentTemperature: number;
  currentFanspeed: number;
  minFanspeed: number;
  maxFanspeed: number;
  minFanMode: number;
  maxFanMode: number;
  data: {
    deviceId: string;
    type: string;
    deviceTerminalId: string;
    roomTemparatureAddress?: string | number;
    roomTemparatureSetPointAddress?: string | number;
    fanspeedAddress?: string | number;
    fanspeedSetPointAddress?: string | number;
    [key: string]: unknown;
  };
  zoneId?: string;
  roomId?: string;
};

export type Room = {
  id: string;
  name: string;
  aircopanels: WallpanelDevice[];
  airconditioners: AirconditionerDevice[];
};

export type Zone = {
  id: string;
  name: string;
  rooms: Room[];
};

export type ApiWallpanelDevice = Partial<WallpanelDevice>;

export type ApiAirconditionerDevice = Partial<AirconditionerDevice> & {
  data?: Partial<AirconditionerDevice['data']>;
};

export type ApiRoom = {
  id?: string;
  name?: string;
  aircopanels?: ApiWallpanelDevice[];
  airconditioners?: ApiAirconditionerDevice[];
};

export type ApiZone = {
  id?: string;
  _id?: string;
  name?: string;
  rooms?: ApiRoom[];
};

export const AIRCO_DEVICE_MODELS = [
  'FC-500PC/FC-1100PC',
  'FC-3000DC/FC-3500DC',
] as const;

export const AIRCO_ADAPTER_TYPES = ['HeinAndHopmanIpSystem'] as const;

export type AircoDeviceDefaults = {
  minTemperature: number;
  maxTemperature: number;
  minSetTemperature: number;
  maxSetTemperature: number;
  setTemperature: number;
  minFanspeed: number;
  maxFanspeed: number;
  minFanMode: number;
  maxFanMode: number;
};

export const GENERIC_AIRCO_DEFAULTS: AircoDeviceDefaults = {
  minTemperature: 16,
  maxTemperature: 30,
  minSetTemperature: 16,
  maxSetTemperature: 30,
  setTemperature: 16,
  minFanspeed: 0,
  maxFanspeed: 4,
  minFanMode: 0,
  maxFanMode: 1,
};

export const FC500_PC_AIRCO_DEFAULTS: AircoDeviceDefaults = {
  minTemperature: 9,
  maxTemperature: 29,
  minSetTemperature: 9,
  maxSetTemperature: 29,
  setTemperature: 9,
  minFanspeed: 1,
  maxFanspeed: 6,
  minFanMode: 0,
  maxFanMode: 1,
};

function normalizeDeviceType(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

export function getAircoDeviceDefaults(
  deviceType?: string,
): AircoDeviceDefaults {
  const normalizedType = normalizeDeviceType(deviceType);

  if (
    normalizedType === 'fc-500pc/fc-1100pc' ||
    normalizedType === 'fc500-pc' ||
    normalizedType === 'dc500-pc'
  ) {
    return FC500_PC_AIRCO_DEFAULTS;
  }

  return GENERIC_AIRCO_DEFAULTS;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeEnvironmentDevice(
  device: Partial<EnvironmentDevice>,
): EnvironmentDevice {
  return {
    id: String(device.id ?? ''),
    name: device.name ?? 'New',
    type: device.type ?? AIRCO_ADAPTER_TYPES[0],
    ip: device.ip ?? '',
    port: String(device.port ?? '502'),
    bidirectional: Boolean(device.bidirectional),
  };
}

export function normalizeWallpanelDevice(
  device?: ApiWallpanelDevice,
): WallpanelDevice {
  const legacyVersion = (device?.version ||
    device?.type ||
    'polarbear-v1') as WallpanelVersion;

  const configuredUnits = Array.isArray((device as any)?.modbusUnits)
    ? ((device as any).modbusUnits as Array<Partial<WallpanelUnit>>)
        .map((unit) => ({
          id: toNumber(unit.id, NaN),
          type: (unit.type || legacyVersion) as WallpanelVersion,
          name: unit.name,
        }))
        .filter((unit) => Number.isFinite(unit.id))
    : [];

  const idsSource =
    configuredUnits.length > 0
      ? configuredUnits.map((unit) => unit.id)
      : Array.isArray(device?.terminalIds)
        ? device.terminalIds
        : Array.isArray(device?.ids)
          ? device.ids
          : [];

  const ids = idsSource
    .map((id) => toNumber(id, NaN))
    .filter((id) => Number.isFinite(id));

  const modbusUnits =
    configuredUnits.length > 0
      ? configuredUnits
      : ids.map((id) => ({
          id,
          type: legacyVersion,
        }));

  return {
    id: String(device?.id ?? ''),
    name: device?.name ?? '',
    ip: device?.ip ?? '',
    version: legacyVersion,
    type: device?.type?.startsWith('polarbear-')
      ? 'moxa'
      : device?.type ?? 'moxa',
    port: toNumber(device?.port, 4001),
    terminalIds: ids,
    modbusUnits,
    ids,
    zoneId: device?.zoneId,
    roomId: device?.roomId,
  };
}

export function normalizeAirconditionerDevice(
  device?: ApiAirconditionerDevice,
): AirconditionerDevice {
  const deviceType = device?.deviceType ?? AIRCO_DEVICE_MODELS[0];
  const defaults = getAircoDeviceDefaults(deviceType);
  const minTemperature = toNumber(
    device?.minTemperature,
    defaults.minTemperature,
  );
  const maxTemperature = toNumber(
    device?.maxTemperature,
    defaults.maxTemperature,
  );
  const minSetTemperature = toNumber(device?.minSetTemperature, minTemperature);
  const maxSetTemperature = toNumber(device?.maxSetTemperature, maxTemperature);
  const minFanspeed = toNumber(device?.minFanspeed, defaults.minFanspeed);
  const maxFanspeed = toNumber(device?.maxFanspeed, defaults.maxFanspeed);
  const minFanMode = toNumber(device?.minFanMode, defaults.minFanMode);
  const maxFanMode = toNumber(device?.maxFanMode, defaults.maxFanMode);

  let setTemperature = toNumber(
    device?.setTemperature,
    defaults.setTemperature,
  );

  if (setTemperature < minSetTemperature) {
    setTemperature = minSetTemperature;
  }

  if (setTemperature > maxSetTemperature) {
    setTemperature = maxSetTemperature;
  }

  return {
    id: String(device?.id ?? ''),
    name: device?.name ?? '',
    deviceType,
    minTemperature,
    maxTemperature,
    minSetTemperature,
    maxSetTemperature,
    setTemperature,
    currentTemperature: toNumber(device?.currentTemperature, -1),
    currentFanspeed: toNumber(device?.currentFanspeed, -1),
    minFanspeed,
    maxFanspeed,
    minFanMode,
    maxFanMode,
    data: {
      ...(device?.data ?? {}),
      deviceId: String(device?.data?.deviceId ?? ''),
      type: String(device?.data?.type ?? AIRCO_ADAPTER_TYPES[0]),
      deviceTerminalId: String(device?.data?.deviceTerminalId ?? ''),
    },
    zoneId: device?.zoneId,
    roomId: device?.roomId,
  };
}

function normalizeRoom(room?: ApiRoom): Room {
  return {
    id: String(room?.id ?? ''),
    name: room?.name ?? '',
    aircopanels: Array.isArray(room?.aircopanels)
      ? room.aircopanels.map((panel) => normalizeWallpanelDevice(panel))
      : [],
    airconditioners: Array.isArray(room?.airconditioners)
      ? room.airconditioners.map((airco) =>
          normalizeAirconditionerDevice(airco),
        )
      : [],
  };
}

export function normalizeZones(raw: ApiZone[]): Zone[] {
  return (raw || []).map((zone) => ({
    id: String(zone.id ?? zone._id ?? ''),
    name: zone.name ?? '',
    rooms: Array.isArray(zone.rooms)
      ? zone.rooms.map((room) => normalizeRoom(room))
      : [],
  }));
}
