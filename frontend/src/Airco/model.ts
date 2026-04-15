export type WallpanelVersion =
  | 'polarbear-v1'
  | 'polarbear-v2'
  | 'polarbear-v3';

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
  data: {
    deviceId: string;
    type: string;
    deviceTerminalId: string;
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
  const idsSource = Array.isArray(device?.terminalIds)
    ? device.terminalIds
    : Array.isArray(device?.ids)
      ? device.ids
      : [];

  const ids = idsSource
    .map((id) => toNumber(id, NaN))
    .filter((id) => Number.isFinite(id));

  const version = (device?.version ||
    device?.type ||
    'polarbear-v1') as WallpanelVersion;

  return {
    id: String(device?.id ?? ''),
    name: device?.name ?? '',
    ip: device?.ip ?? '',
    version,
    type: device?.type ?? version,
    port: toNumber(device?.port, 4001),
    terminalIds: ids,
    ids,
    zoneId: device?.zoneId,
    roomId: device?.roomId,
  };
}

export function normalizeAirconditionerDevice(
  device?: ApiAirconditionerDevice,
): AirconditionerDevice {
  const minTemperature = toNumber(device?.minTemperature, 16);
  const maxTemperature = toNumber(device?.maxTemperature, 30);
  const minSetTemperature = toNumber(device?.minSetTemperature, minTemperature);
  const maxSetTemperature = toNumber(device?.maxSetTemperature, maxTemperature);
  const minFanspeed = toNumber(device?.minFanspeed, 0);
  const maxFanspeed = toNumber(device?.maxFanspeed, 4);

  let setTemperature = toNumber(device?.setTemperature, minSetTemperature);

  if (setTemperature < minSetTemperature) {
    setTemperature = minSetTemperature;
  }

  if (setTemperature > maxSetTemperature) {
    setTemperature = maxSetTemperature;
  }

  return {
    id: String(device?.id ?? ''),
    name: device?.name ?? '',
    deviceType: device?.deviceType ?? AIRCO_DEVICE_MODELS[0],
    minTemperature,
    maxTemperature,
    minSetTemperature,
    maxSetTemperature,
    setTemperature,
    currentTemperature: toNumber(device?.currentTemperature, -1),
    currentFanspeed: toNumber(device?.currentFanspeed, -1),
    minFanspeed,
    maxFanspeed,
    data: {
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
      ? room.airconditioners.map((airco) => normalizeAirconditionerDevice(airco))
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
