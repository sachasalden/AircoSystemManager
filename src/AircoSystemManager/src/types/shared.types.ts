import type { ObjectId } from "mongodb";

export type Zone = 1 | 2;
export type FlagType = "setpoint" | "fanMode";

export type Unit = {
  id: number;
  name: string;
  zones: Zone[];
  type?: string;
};

export type VirtualTemperatureTarget = {
  unitId: number;
  name: string;
  zone: Zone;
  register: number;
};

export type Candidate =
  | {
  type: "setpoint";
  sourceUnitId: number;
  zone: Zone;
  value: number;
  signature: string;
  changedAt: number;
  createdAt: number;
}
  | {
  type: "fanMode";
  sourceUnitId: number;
  zone: Zone;
  fanMode: number;
  fanSpeed: number;
  signature: string;
  changedAt: number;
  createdAt: number;
};

export type MqttWallpanelCommand =
  | {
  type: "setpoint";
  zone: Zone;
  value: number;
  signature: string;
  createdAt: number;
}
  | {
  type: "fanMode";
  zone: Zone;
  value: number;
  createdAt: number;
}
  | {
  type: "fanSpeed";
  zone: Zone;
  value: number;
  createdAt: number;
};

export type SetpointCache = {
  value: number;
  signature: string;
  changedAt: number;
};

export type SuppressedWrite = {
  signature: string;
  until: number;
};

export type AircoConnection = {
  host: string;
  port: number;
  model?: string;
  type?: string;
  bidirectional?: boolean;
};

export type RegisterType = "readInput" | "readHold" | "writeHold";

export type DbModbusUnit = {
  id: number | string;
  name?: string;
  type?: string;
  version?: string;
  zones?: Array<number | string>;
};

export type DbAircoPanel = {
  id: string;
  name?: string;
  ip: string;
  type?: string;
  model?: string;
  port: number | string;
  ids?: Array<number | string>;
  modbusUnits?: DbModbusUnit[];
};

export type DbAirconditioner = {
  id: string;
  name?: string;
  deviceType?: string;
  data?: {
    deviceId?: string;
    deviceTerminalId?: string;
    type?: string;
  };
};

export type DbRoom = {
  id: string;
  name?: string;
  airconditioners?: DbAirconditioner[];
  aircopanels?: DbAircoPanel[];
};

export type ClimatezoneDocument = {
  _id: ObjectId;
  name: string;
  rooms?: DbRoom[];
};

export type EnvironmentAircoDeviceDocument = {
  _id: ObjectId;
  id: string;
  name?: string;
  type?: string;
  ip: string;
  port: number | string;
  bidirectional?: boolean;
};

export type RuntimeSettings = {
  climatezoneId: string;
  climatezoneName: string;
  roomId: string;
  roomName: string;
  wallpanel: {
    id: string;
    name: string;
    host: string;
    port: number;
    units: Array<{
      id: number;
      name: string;
      type: string;
      zones: Zone[];
    }>;
  };
  airco: {
    airconditionerId: string;
    deviceId: string;
    name: string;
    host: string;
    port: number;
    model: string;
    unitId: number;
    bidirectional: boolean;
  };
};

export type SettingsPatch = Partial<{
  wallpanel: Partial<{
    host: string;
    port: number | string;
    units: Array<Partial<{
      id: number | string;
      name: string;
      type: string;
      zones: Array<number | string>;
    }>>;
  }>;
  airco: Partial<{
    host: string;
    port: number | string;
    model: string;
    unitId: number | string;
    bidirectional: boolean;
  }>;
}>;

export type PolarbearAdminController = {
  getPolarbearLoopStatus: () => { paused: boolean };
  pausePolarbearLoop: () => Promise<void>;
  resumePolarbearLoop: () => Promise<void>;
  rebootPolarbears: (unitIds: number[]) => Promise<void>;
  setPolarbearBaudrate: (unitIds: number[], baudrate: number) => Promise<void>;
};

export type PolarbearMqttHandlers = {
  onVirtualTemperature: (value: number) => void;
  onSetTemperatureCommand: (value: number) => void;
  onFanModeCommand: (value: number) => void;
  onFanSpeedCommand: (value: number) => void;
  onSetTemperatureState: (value: number) => void;
  onFanModeState: (value: number) => void;
  onFanSpeedState: (value: number) => void;
};

