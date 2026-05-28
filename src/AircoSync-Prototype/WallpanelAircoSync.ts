import ModbusRTU from "modbus-serial";
import * as mqtt from "mqtt";
import * as jsmodbus from "jsmodbus";
import * as net from "net";
import { MongoClient, ObjectId, type Db } from "mongodb";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";

/* -------------------------------------------------------------------------- */
/* models/types.ts */
/* -------------------------------------------------------------------------- */

type Zone = 1 | 2;
type FlagType = "setpoint" | "fanMode";

type Unit = {
  id: number;
  name: string;
  zones: Zone[];
  type?: string;
};

type VirtualTemperatureTarget = {
  unitId: number;
  name: string;
  zone: Zone;
  register: number;
};

type Candidate =
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

type MqttWallpanelCommand =
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

type SetpointCache = {
  value: number;
  signature: string;
  changedAt: number;
};

type SuppressedWrite = {
  signature: string;
  until: number;
};

type AircoConnection = {
  host: string;
  port: number;
  model?: string;
  type?: string;
  bidirectional?: boolean;
};

type RegisterType = "readInput" | "readHold" | "writeHold";

type DbModbusUnit = {
  id: number | string;
  name?: string;
  type?: string;
  version?: string;
  zones?: Array<number | string>;
};

type DbAircoPanel = {
  id: string;
  name?: string;
  ip: string;
  type?: string;
  model?: string;
  port: number | string;
  ids?: Array<number | string>;
  modbusUnits?: DbModbusUnit[];
};

type DbAirconditioner = {
  id: string;
  name?: string;
  deviceType?: string;
  data?: {
    deviceId?: string;
    deviceTerminalId?: string;
    type?: string;
  };
};

type DbRoom = {
  id: string;
  name?: string;
  airconditioners?: DbAirconditioner[];
  aircopanels?: DbAircoPanel[];
};

type ClimatezoneDocument = {
  _id: ObjectId;
  name: string;
  rooms?: DbRoom[];
};

type EnvironmentAircoDeviceDocument = {
  _id: ObjectId;
  id: string;
  name?: string;
  type?: string;
  ip: string;
  port: number | string;
  bidirectional?: boolean;
};

type RuntimeSettings = {
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

type SettingsPatch = Partial<{
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

type PolarbearAdminController = {
  getPolarbearLoopStatus: () => { paused: boolean };
  pausePolarbearLoop: () => Promise<void>;
  resumePolarbearLoop: () => Promise<void>;
  rebootPolarbears: (unitIds: number[]) => Promise<void>;
  setPolarbearBaudrate: (unitIds: number[], baudrate: number) => Promise<void>;
};

type PolarbearMqttHandlers = {
  onVirtualTemperature: (value: number) => void;
  onSetTemperatureCommand: (value: number) => void;
  onFanModeCommand: (value: number) => void;
  onFanSpeedCommand: (value: number) => void;
  onSetTemperatureState: (value: number) => void;
  onFanModeState: (value: number) => void;
  onFanSpeedState: (value: number) => void;
};

/* -------------------------------------------------------------------------- */
/* config/runtime.ts */
/* -------------------------------------------------------------------------- */

const CONFIG = {
  runMode: "both" as "both" | "polarbearPublisher" | "aircoBridge",

  wallpanel: {
    host: "192.168.55.97",
    port: 4001,
    timeoutMs: 10000,
    requestGapMs: 100,
    pollIntervalMs: 100,

    debounceMs: 5000,
    suppressOwnWriteMs: 12000,

    /**
     * Pauze tussen virtualTemp writes:
     * unit 1 register 603 -> 300ms -> unit 2 register 21051
     */
    virtualTempWriteGapMs: 300,

    /**
     * Normale setTemperature/fan-sync.
     * Alleen zone 1.
     */
    units: [
      { id: 1, name: "v1", zones: [1] },
      { id: 2, name: "v3", zones: [1] },
    ] as Unit[],

    /**
     * VirtualTemp alleen zone 1:
     * - unit 1 / v1 -> register 603
     * - unit 2 / v3 -> register 21051
     */
    virtualTemperatureTargets: [
      { unitId: 1, name: "v1", zone: 1, register: 603 },
      { unitId: 2, name: "v3", zone: 1, register: 21051 },
    ] as VirtualTemperatureTarget[],
  },

  airco: {
    host: "192.168.55.10",
    port: 502,
    unitId: 1,
    zone: 1 as Zone,

    model: "FC-3000DC/FC-3500DC",
    bidirectional: true,

    virtualTempPollIntervalMs: 2000,
    requestTimeoutMs: 5000,
  },

  mqtt: {
    broker: "mqtt://192.168.55.10",
    topicBase: "polarbears/wallpanel/airco",

    retainCommands: false,
    retainStates: true,
  },

  control: {
    enabled: true,
    host: "0.0.0.0",
    port: 8088,
    requestBodyLimitBytes: 32 * 1024,
  },

  database: {
    uri:
      process.env.MONGO_URI ??
      "mongodb://wallpanel:wallpanel@localhost:27017/wallpanel_sync?authSource=admin",
    name: process.env.MONGO_DB ?? "wallpanel_sync",
    climatezonesCollection: "Climatezones",
    aircoDevicesCollection: "enviormentsaircodevices",
  },
};

const REGISTERS = {
  zone1Setpoint: 601,
  zone1FanMode: 606,
  zone1FanSpeed: 607,
  zone2Setpoint: 701,
  zone2FanMode: 706,
  zone2FanSpeed: 707,
  baudRate: 9002,
};

const COILS = {
  reboot: 9991,
};

const BAUDRATE_VALUES: Record<number, number> = {
  9600: 2,
  19200: 3,
  57600: 4,
  115200: 5,
};

const INPUTS = {
  flagReg0: 110,
  flagReg7: 117,
  flagReg8: 118,
};

const FLAG_BITS: Record<FlagType, Record<Zone, number>> = {
  setpoint: {
    1: 0,
    2: 8,
  },
  fanMode: {
    1: 1,
    2: 9,
  },
};

const DEVICE_TYPE_A = "FC-500PC/FC-1100PC";
const DEVICE_TYPE_B = "FC-3000DC/FC-3500DC";

const TOPICS = {
  setTemperatureSet: `${CONFIG.mqtt.topicBase}/setTemperature/set`,
  setTemperatureState: `${CONFIG.mqtt.topicBase}/setTemperature/state`,

  fanModeSet: `${CONFIG.mqtt.topicBase}/fanMode/set`,
  fanModeState: `${CONFIG.mqtt.topicBase}/fanMode/state`,

  fanSpeedSet: `${CONFIG.mqtt.topicBase}/fanSpeed/set`,
  fanSpeedState: `${CONFIG.mqtt.topicBase}/fanSpeed/state`,

  virtualTempState: `${CONFIG.mqtt.topicBase}/virtualTemp/state`,
};

/* -------------------------------------------------------------------------- */
/* utils/helpers.ts */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const log = (message: string): void => {
  const time = new Date().toISOString().split("T")[1].replace("Z", "");
  console.log(`[${time}] ${message}`);
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const zoneRegister = (zone: Zone, zone1: number, zone2: number): number =>
  zone === 1 ? zone1 : zone2;

const zoneFlagRegister = (zone: Zone): number =>
  zone === 1 ? INPUTS.flagReg7 : INPUTS.flagReg8;

const round1 = (value: number): number => Math.round(value * 10) / 10;

const roundHalf = (value: number): number => Math.round(value * 2) / 2;

const normalizeFanMode = (value: number): number => (value === 0 ? 0 : 1);

const hasFlag = (flags: number, zone: Zone, type: FlagType): boolean =>
  (flags & (1 << FLAG_BITS[type][zone])) !== 0;

const candidateKey = (zone: Zone, type: FlagType): string => `${zone}:${type}`;

const sourceKey = (unitId: number, zone: Zone, type: FlagType): string =>
  `${unitId}:${zone}:${type}`;

const virtualTempTargetKey = (target: VirtualTemperatureTarget): string =>
  `${target.unitId}:${target.zone}:${target.register}`;

const setpointSignature = (value: number): string =>
  `setpoint:${round1(value)}`;

const fanSignature = (fanMode: number, fanSpeed: number): string =>
  `fanMode:${normalizeFanMode(fanMode)}:fanSpeed:${fanSpeed}`;

const virtualTempSignature = (value: number): string =>
  `virtualTemp:${roundHalf(value)}`;

const encodeTemperature = (value: number): number =>
  Math.round(roundHalf(value) * 10);

const decodePendingSetpoint = (raw: number): number => {
  const lowBits = (raw & 0x00c0) >> 6;
  const highBits = (raw & 0xff00) >> 8;

  return round1(((highBits << 2) | lowBits) / 10);
};

const toNumber = (payload: Buffer): number | null => {
  const value = Number(payload.toString().trim());

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
};

const parseCommandNumber = (payload: unknown): number | null => {
  if (typeof payload === "number" && Number.isFinite(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const value = record.value ?? record.temperature ?? record.setpoint ?? record.speed ?? record.mode;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const isTimeoutError = (error: unknown): boolean => {
  const err = error as any;

  return (
    err?.name === "TransactionTimedOutError" ||
    String(err?.message ?? "").toLowerCase().includes("timed out") ||
    String(err?.message ?? "").toLowerCase().includes("timeout")
  );
};

const toPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed);
};

const toZone = (value: unknown): Zone | null => {
  const parsed = Number(value);

  return parsed === 1 || parsed === 2 ? parsed : null;
};

export const toZones = (values: unknown, fallback: Zone[] = [1]): Zone[] => {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const zones = values
    .map((value) => toZone(value))
    .filter((value): value is Zone => value !== null);

  return zones.length > 0 ? zones : fallback;
};

const defaultPanelTypeForUnit = (
  unitId: number,
  fallback = "polarbear-v1",
): string => {
  if (unitId === 1) return "polarbear-v1";
  if (unitId === 2) return "polarbear-v3";

  return fallback;
};

const defaultVirtualTempRegisterForUnit = (unitId: number, type: string): number => {
  if (unitId === 1 || type === "polarbear-v1") return 603;
  if (unitId === 2 || type === "polarbear-v3") return 21051;

  return 603;
};

const normalizeModbusUnits = (panel: DbAircoPanel): RuntimeSettings["wallpanel"]["units"] => {
  const configuredUnits: DbModbusUnit[] =
    panel.modbusUnits && panel.modbusUnits.length > 0
      ? panel.modbusUnits
      : (panel.ids ?? []).map((id) => ({ id }));

  return configuredUnits.map((unit, index) => {
    const id = toPositiveInt(unit.id, index + 1);
    const type = String(unit.type ?? unit.version ?? defaultPanelTypeForUnit(id, panel.type));
    const zones = toZones(unit.zones, [1]);

    return {
      id,
      name: String(unit.name ?? type.replace("polarbear-", "")),
      type,
      zones,
    };
  });
};

const applyRuntimeSettings = (settings: RuntimeSettings): void => {
  CONFIG.wallpanel.host = settings.wallpanel.host;
  CONFIG.wallpanel.port = settings.wallpanel.port;
  CONFIG.wallpanel.units = settings.wallpanel.units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    zones: unit.zones,
    type: unit.type,
  }));
  CONFIG.wallpanel.virtualTemperatureTargets = settings.wallpanel.units.map((unit) => ({
    unitId: unit.id,
    name: unit.name,
    zone: unit.zones[0] ?? 1,
    register: defaultVirtualTempRegisterForUnit(unit.id, unit.type),
  }));

  CONFIG.airco.host = settings.airco.host;
  CONFIG.airco.port = settings.airco.port;
  CONFIG.airco.unitId = settings.airco.unitId;
  CONFIG.airco.model = settings.airco.model;
  CONFIG.airco.bidirectional = settings.airco.bidirectional;
};

/* -------------------------------------------------------------------------- */
/* services/ConfigStore.ts */
/* -------------------------------------------------------------------------- */

class ConfigStore {
  private client?: MongoClient;
  private database?: Db;

  async connect(): Promise<void> {
    this.client = new MongoClient(CONFIG.database.uri);
    await this.client.connect();
    this.database = this.client.db(CONFIG.database.name);
    log(`mongodb verbonden database=${CONFIG.database.name}`);
  }

  async close(): Promise<void> {
    await this.client?.close();
  }

  async loadAndApply(): Promise<RuntimeSettings> {
    const settings = await this.getSettings();
    applyRuntimeSettings(settings);

    log(
      `config geladen uit mongodb panel=${settings.wallpanel.host}:${settings.wallpanel.port} airco=${settings.airco.host}:${settings.airco.port}`,
    );

    return settings;
  }

  async getSettings(): Promise<RuntimeSettings> {
    const database = this.getDatabase();
    const climatezone = await database
      .collection<ClimatezoneDocument>(CONFIG.database.climatezonesCollection)
      .findOne({ "rooms.aircopanels.0": { $exists: true } });

    if (!climatezone) {
      throw new Error("geen climatezone met aircopanel gevonden");
    }

    const room = this.findConfigRoom(climatezone);
    const panel = room.aircopanels?.[0];
    const airconditioner = room.airconditioners?.[0];

    if (!panel) {
      throw new Error("geen aircopanel in climatezone room gevonden");
    }

    if (!airconditioner?.data?.deviceId) {
      throw new Error("geen airconditioner deviceId in climatezone room gevonden");
    }

    const device = await database
      .collection<EnvironmentAircoDeviceDocument>(
        CONFIG.database.aircoDevicesCollection,
      )
      .findOne({ id: airconditioner.data.deviceId });

    if (!device) {
      throw new Error(
        `geen airco device gevonden voor id=${airconditioner.data.deviceId}`,
      );
    }

    const units = normalizeModbusUnits(panel);

    return {
      climatezoneId: climatezone._id.toHexString(),
      climatezoneName: climatezone.name,
      roomId: room.id,
      roomName: String(room.name ?? ""),
      wallpanel: {
        id: panel.id,
        name: String(panel.name ?? ""),
        host: panel.ip,
        port: toPositiveInt(panel.port, CONFIG.wallpanel.port),
        units,
      },
      airco: {
        airconditionerId: airconditioner.id,
        deviceId: device.id,
        name: String(device.name ?? airconditioner.name ?? ""),
        host: device.ip,
        port: toPositiveInt(device.port, CONFIG.airco.port),
        model: String(airconditioner.deviceType ?? CONFIG.airco.model),
        unitId: toPositiveInt(
          airconditioner.data.deviceTerminalId,
          CONFIG.airco.unitId,
        ),
        bidirectional: device.bidirectional !== false,
      },
    };
  }

  async updateSettings(patch: SettingsPatch): Promise<RuntimeSettings> {
    const current = await this.getSettings();
    const next = this.mergeSettings(current, patch);
    const database = this.getDatabase();
    const climatezoneObjectId = new ObjectId(next.climatezoneId);

    await database.collection(CONFIG.database.climatezonesCollection).updateOne(
      {
        _id: climatezoneObjectId,
        "rooms.id": next.roomId,
      },
      {
        $set: {
          "rooms.$[room].aircopanels.$[panel].ip": next.wallpanel.host,
          "rooms.$[room].aircopanels.$[panel].port": next.wallpanel.port,
          "rooms.$[room].aircopanels.$[panel].ids": next.wallpanel.units.map(
            (unit) => unit.id,
          ),
          "rooms.$[room].aircopanels.$[panel].type":
            next.wallpanel.units[0]?.type ?? "polarbear-v1",
          "rooms.$[room].aircopanels.$[panel].modbusUnits":
          next.wallpanel.units,
          "rooms.$[room].airconditioners.$[airco].deviceType":
          next.airco.model,
          "rooms.$[room].airconditioners.$[airco].data.deviceTerminalId":
            String(next.airco.unitId),
        },
      },
      {
        arrayFilters: [
          { "room.id": next.roomId },
          { "panel.id": next.wallpanel.id },
          { "airco.id": next.airco.airconditionerId },
        ],
      },
    );

    await database
      .collection(CONFIG.database.aircoDevicesCollection)
      .updateOne(
        { id: next.airco.deviceId },
        {
          $set: {
            ip: next.airco.host,
            port: String(next.airco.port),
            bidirectional: next.airco.bidirectional,
          },
        },
      );

    applyRuntimeSettings(next);

    return next;
  }

  async getFrontendZones(): Promise<unknown[]> {
    const database = this.getDatabase();
    const zones = await database
      .collection<ClimatezoneDocument>(CONFIG.database.climatezonesCollection)
      .find({})
      .toArray();

    return zones.map((zone) => ({
      id: zone._id.toHexString(),
      _id: zone._id.toHexString(),
      name: zone.name,
      rooms: (zone.rooms ?? []).map((room) => ({
        id: room.id,
        name: room.name ?? "",
        aircopanels: (room.aircopanels ?? []).map((panel) => ({
          ...panel,
          zoneId: zone._id.toHexString(),
          roomId: room.id,
          port: toPositiveInt(panel.port, CONFIG.wallpanel.port),
          ids: (panel.ids ?? []).map((id) => toPositiveInt(id, 0)).filter(Boolean),
          modbusUnits: normalizeModbusUnits(panel),
        })),
        airconditioners: (room.airconditioners ?? []).map((airco) => ({
          ...airco,
          zoneId: zone._id.toHexString(),
          roomId: room.id,
        })),
      })),
    }));
  }

  async getEnvironmentDevices(): Promise<unknown[]> {
    return this.getDatabase()
      .collection<EnvironmentAircoDeviceDocument>(CONFIG.database.aircoDevicesCollection)
      .find({})
      .toArray();
  }

  async addEnvironmentDevice(device: Partial<EnvironmentAircoDeviceDocument>): Promise<unknown> {
    const next = {
      id: String(device.id ?? randomUUID()),
      name: String(device.name ?? "New"),
      type: String(device.type ?? "HeinAndHopmanIpSystem"),
      ip: String(device.ip ?? ""),
      port: String(device.port ?? "502"),
      bidirectional: device.bidirectional !== false,
    };

    await this.getDatabase()
      .collection(CONFIG.database.aircoDevicesCollection)
      .insertOne(next);

    return next;
  }

  async updateEnvironmentDevice(
    id: string,
    patch: Partial<EnvironmentAircoDeviceDocument>,
  ): Promise<unknown> {
    await this.getDatabase()
      .collection(CONFIG.database.aircoDevicesCollection)
      .updateOne(
        { id },
        {
          $set: {
            name: patch.name,
            type: patch.type,
            ip: patch.ip,
            port: String(patch.port ?? ""),
            bidirectional: patch.bidirectional,
          },
        },
      );

    return this.getDatabase()
      .collection(CONFIG.database.aircoDevicesCollection)
      .findOne({ id });
  }

  async deleteEnvironmentDevice(id: string): Promise<void> {
    await this.getDatabase()
      .collection(CONFIG.database.aircoDevicesCollection)
      .deleteOne({ id });
  }

  async addPanel(panel: Partial<DbAircoPanel> & { zoneId: string; roomId: string }): Promise<unknown> {
    const next = this.normalizePanelForDb(panel);

    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { _id: new ObjectId(panel.zoneId), "rooms.id": panel.roomId },
        { $push: { "rooms.$.aircopanels": next } },
      );

    return { ...next, zoneId: panel.zoneId, roomId: panel.roomId };
  }

  async updatePanel(id: string, panel: Partial<DbAircoPanel>): Promise<unknown> {
    const zones = await this.getDatabase()
      .collection<ClimatezoneDocument>(CONFIG.database.climatezonesCollection)
      .find({ "rooms.aircopanels.id": id })
      .toArray();
    const zone = zones[0];
    const room = zone?.rooms?.find((candidate) =>
      candidate.aircopanels?.some((item) => item.id === id),
    );

    if (!zone || !room) {
      throw new Error(`aircopanel niet gevonden: ${id}`);
    }

    const next = this.normalizePanelForDb({ ...panel, id });

    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { _id: zone._id },
        { $set: { "rooms.$[room].aircopanels.$[panel]": next } },
        { arrayFilters: [{ "room.id": room.id }, { "panel.id": id }] },
      );

    return { ...next, zoneId: zone._id.toHexString(), roomId: room.id };
  }

  async deletePanel(id: string): Promise<void> {
    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { "rooms.aircopanels.id": id },
        { $pull: { "rooms.$[].aircopanels": { id } } },
      );
  }

  async addAirconditioner(
    airco: Partial<DbAirconditioner> & { zoneId: string; roomId: string },
  ): Promise<unknown> {
    const next = this.normalizeAirconditionerForDb(airco);

    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { _id: new ObjectId(airco.zoneId), "rooms.id": airco.roomId },
        { $push: { "rooms.$.airconditioners": next } },
      );

    return { ...next, zoneId: airco.zoneId, roomId: airco.roomId };
  }

  async updateAirconditioner(id: string, airco: Partial<DbAirconditioner>): Promise<unknown> {
    const zones = await this.getDatabase()
      .collection<ClimatezoneDocument>(CONFIG.database.climatezonesCollection)
      .find({ "rooms.airconditioners.id": id })
      .toArray();
    const zone = zones[0];
    const room = zone?.rooms?.find((candidate) =>
      candidate.airconditioners?.some((item) => item.id === id),
    );

    if (!zone || !room) {
      throw new Error(`airconditioner niet gevonden: ${id}`);
    }

    const next = this.normalizeAirconditionerForDb({ ...airco, id });

    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { _id: zone._id },
        { $set: { "rooms.$[room].airconditioners.$[airco]": next } },
        { arrayFilters: [{ "room.id": room.id }, { "airco.id": id }] },
      );

    return { ...next, zoneId: zone._id.toHexString(), roomId: room.id };
  }

  async deleteAirconditioner(id: string): Promise<void> {
    await this.getDatabase()
      .collection(CONFIG.database.climatezonesCollection)
      .updateOne(
        { "rooms.airconditioners.id": id },
        { $pull: { "rooms.$[].airconditioners": { id } } },
      );
  }

  private getDatabase(): Db {
    if (!this.database) {
      throw new Error("mongodb is niet verbonden");
    }

    return this.database;
  }

  private normalizePanelForDb(panel: Partial<DbAircoPanel>): DbAircoPanel {
    const id = String(panel.id ?? randomUUID());
    const modbusUnits = normalizeModbusUnits({
      id,
      name: panel.name,
      ip: String(panel.ip ?? ""),
      type: panel.type,
      port: panel.port ?? CONFIG.wallpanel.port,
      ids: panel.ids,
      modbusUnits: panel.modbusUnits,
    });

    return {
      id,
      name: String(panel.name ?? ""),
      ip: String(panel.ip ?? ""),
      type: String(panel.type ?? modbusUnits[0]?.type ?? "moxa"),
      model: String(panel.model ?? ""),
      port: toPositiveInt(panel.port, CONFIG.wallpanel.port),
      ids: modbusUnits.map((unit) => unit.id),
      modbusUnits,
    };
  }

  private normalizeAirconditionerForDb(airco: Partial<DbAirconditioner>): DbAirconditioner {
    return {
      ...(airco as DbAirconditioner),
      id: String(airco.id ?? randomUUID()),
      name: String(airco.name ?? ""),
      deviceType: String(airco.deviceType ?? CONFIG.airco.model),
      data: {
        deviceId: String(airco.data?.deviceId ?? ""),
        type: String(airco.data?.type ?? "HeinAndHopmanIpSystem"),
        deviceTerminalId: String(airco.data?.deviceTerminalId ?? CONFIG.airco.unitId),
        ...airco.data,
      },
    };
  }

  private findConfigRoom(climatezone: ClimatezoneDocument): DbRoom {
    const room = climatezone.rooms?.find(
      (candidate) =>
        (candidate.aircopanels?.length ?? 0) > 0 &&
        (candidate.airconditioners?.length ?? 0) > 0,
    );

    if (!room) {
      throw new Error("geen room met aircopanel en airconditioner gevonden");
    }

    return room;
  }

  private mergeSettings(
    current: RuntimeSettings,
    patch: SettingsPatch,
  ): RuntimeSettings {
    const patchedUnits =
      patch.wallpanel?.units?.map((unit, index) => {
        const previous =
          current.wallpanel.units[index] ??
          current.wallpanel.units[current.wallpanel.units.length - 1];
        const id = toPositiveInt(unit.id, previous?.id ?? index + 1);
        const type = String(
          unit.type ?? previous?.type ?? defaultPanelTypeForUnit(id),
        );

        return {
          id,
          name: String(unit.name ?? previous?.name ?? type),
          type,
          zones: toZones(unit.zones, previous?.zones ?? [1]),
        };
      }) ?? current.wallpanel.units;

    return {
      ...current,
      wallpanel: {
        ...current.wallpanel,
        host: String(patch.wallpanel?.host ?? current.wallpanel.host),
        port: toPositiveInt(patch.wallpanel?.port, current.wallpanel.port),
        units: patchedUnits,
      },
      airco: {
        ...current.airco,
        host: String(patch.airco?.host ?? current.airco.host),
        port: toPositiveInt(patch.airco?.port, current.airco.port),
        model: String(patch.airco?.model ?? current.airco.model),
        unitId: toPositiveInt(patch.airco?.unitId, current.airco.unitId),
        bidirectional:
          patch.airco?.bidirectional ?? current.airco.bidirectional,
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/* services/ModbusClient.ts */
/* -------------------------------------------------------------------------- */

class ModbusClient {
  private client = new ModbusRTU();
  private connected = false;
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private requestGapMs: number;

  constructor(timeoutMs: number, requestGapMs: number) {
    this.requestGapMs = requestGapMs;
    this.client.setTimeout(timeoutMs);
  }

  async connect(host: string, port: number): Promise<void> {
    if (this.connected) return;

    await new Promise<void>((resolve, reject) => {
      (this.client as any).connectTelnet(host, { port }, (error: any) => {
        if (error) {
          this.connected = false;
          reject(error);
          return;
        }

        this.connected = true;
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.connected) return;

    await new Promise<void>((resolve) => {
      this.client.close(() => {
        this.connected = false;
        resolve();
      });
    });
  }

  setId(unitId: number): void {
    this.client.setID(unitId);
  }

  async read(register: number, count = 1): Promise<number[]> {
    return this.enqueue(async () => {
      await this.waitForGap();

      const response = await this.client.readHoldingRegisters(register, count);
      this.lastRequestAt = Date.now();

      return response.data;
    });
  }

  async write(register: number, value: number): Promise<void> {
    await this.enqueue(async () => {
      await this.waitForGap();

      await this.client.writeRegister(register, value);
      this.lastRequestAt = Date.now();
    });
  }

  async writeCoil(coil: number, value: boolean): Promise<void> {
    await this.enqueue(async () => {
      await this.waitForGap();

      await this.client.writeCoil(coil, value);
      this.lastRequestAt = Date.now();
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);

    this.queue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  private async waitForGap(): Promise<void> {
    if (this.requestGapMs <= 0) return;

    const elapsed = Date.now() - this.lastRequestAt;
    const waitMs = this.requestGapMs - elapsed;

    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* services/Polarbear.ts */
/* -------------------------------------------------------------------------- */

class Polarbear {
  private client: ModbusClient;

  constructor(client: ModbusClient) {
    this.client = client;
  }

  async getFlags(unitId: number): Promise<number> {
    this.client.setId(unitId);

    const data = await this.client.read(INPUTS.flagReg0);

    return data[0] ?? 0;
  }

  async clearFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<number> {
    this.client.setId(unitId);

    const flags = currentFlags ?? (await this.getFlags(unitId));
    const nextFlags = flags & ~(1 << FLAG_BITS[type][zone]);

    if (nextFlags !== flags) {
      await this.client.write(INPUTS.flagReg0, nextFlags);
    }

    return nextFlags;
  }

  async getPendingRegister(unitId: number, zone: Zone): Promise<number> {
    this.client.setId(unitId);

    const data = await this.client.read(zoneFlagRegister(zone));

    return data[0] ?? 0;
  }

  async getPendingSetpoint(unitId: number, zone: Zone): Promise<number> {
    const raw = await this.getPendingRegister(unitId, zone);

    return decodePendingSetpoint(raw);
  }

  async getPendingFanMode(unitId: number, zone: Zone): Promise<number> {
    const raw = await this.getPendingRegister(unitId, zone);

    return normalizeFanMode(raw & 0x0007);
  }

  async getFanSpeed(unitId: number, zone: Zone): Promise<number> {
    this.client.setId(unitId);

    const register = zoneRegister(
      zone,
      REGISTERS.zone1FanSpeed,
      REGISTERS.zone2FanSpeed,
    );

    const data = await this.client.read(register);

    return data[0] ?? 0;
  }

  async setSetpoint(unitId: number, zone: Zone, value: number): Promise<void> {
    this.client.setId(unitId);

    const register = zoneRegister(
      zone,
      REGISTERS.zone1Setpoint,
      REGISTERS.zone2Setpoint,
    );

    await this.client.write(register, Math.round(value * 10));
  }

  async setFanMode(unitId: number, zone: Zone, value: number): Promise<void> {
    this.client.setId(unitId);

    const register = zoneRegister(
      zone,
      REGISTERS.zone1FanMode,
      REGISTERS.zone2FanMode,
    );

    await this.client.write(register, normalizeFanMode(value));
  }

  async setFanSpeed(unitId: number, zone: Zone, value: number): Promise<void> {
    this.client.setId(unitId);

    const register = zoneRegister(
      zone,
      REGISTERS.zone1FanSpeed,
      REGISTERS.zone2FanSpeed,
    );

    await this.client.write(register, value);
  }

  async setVirtualTemperature(
    target: VirtualTemperatureTarget,
    value: number,
  ): Promise<void> {
    this.client.setId(target.unitId);

    const rounded = roundHalf(value);
    const encoded = encodeTemperature(rounded);

    await this.client.write(target.register, encoded);

    log(
      `virtualTemp geschreven ${target.name} unit=${target.unitId} zone=${target.zone} register=${target.register} value=${rounded} encoded=${encoded}`,
    );
  }

  async setBaudrate(unitIds: number[], baudrate: number): Promise<void> {
    const encodedValue = BAUDRATE_VALUES[baudrate];

    if (encodedValue === undefined) {
      throw new Error(
        `Unsupported baudrate: ${baudrate}. Supported: ${Object.keys(
          BAUDRATE_VALUES,
        ).join(", ")}`,
      );
    }

    log(`polarbear baudrate instellen ${baudrate} encoded=${encodedValue}`);

    for (const unitId of unitIds) {
      log(`polarbear baudrate request unit=${unitId}`);
      this.client.setId(unitId);
      await this.client.write(REGISTERS.baudRate, encodedValue);
      log(`polarbear baudrate gezet unit=${unitId} value=${baudrate}`);
      await sleep(500);
    }
  }

  async reboot(unitIds: number[]): Promise<void> {
    for (const unitId of unitIds) {
      log(`polarbear reboot request unit=${unitId}`);
      this.client.setId(unitId);

      try {
        await this.client.writeCoil(COILS.reboot, true);
      } catch (error) {
        log(
          `polarbear reboot response genegeerd unit=${unitId}: ${formatError(error)}`,
        );
      }

      log(`polarbear reboot gestart unit=${unitId}`);
      await sleep(500);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* services/HopmannAdapter.ts */
/* -------------------------------------------------------------------------- */

class HopmannAdapter {
  private connection: AircoConnection;

  constructor(connection: AircoConnection) {
    this.connection = connection;
  }

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  private getDeviceType(): string {
    return String(this.connection.model ?? this.connection.type ?? "");
  }

  private isBidirectional(): boolean {
    return this.connection.bidirectional !== false;
  }

  private isTypeA(type: string): boolean {
    return type === DEVICE_TYPE_A;
  }

  private isTypeB(type: string): boolean {
    return type === DEVICE_TYPE_B;
  }

  private tempRegister(type: string): number {
    return this.isTypeA(type) || this.isTypeB(type) ? 0 : 100;
  }

  private fanRegister(type: string): number {
    if (this.isTypeA(type)) return 2;
    if (this.isTypeB(type)) return 1;
    return 102;
  }

  private powerRegister(type: string): number {
    if (this.isTypeA(type)) return 1;
    if (this.isTypeB(type)) return 2;
    return 102;
  }

  private hasSeparatePowerRegister(type: string): boolean {
    return this.isTypeA(type) || this.isTypeB(type);
  }

  private encodeFanSpeed(type: string, speed: number): number {
    if (this.isTypeA(type) || this.isTypeB(type)) return speed;

    return speed * 10;
  }

  /**
   * Bewust per request:
   * connect -> read/write -> close.
   */
  private async readOrWrite(
    unitId: number,
    register: number,
    type: RegisterType,
    value = 1,
  ): Promise<any> {
    return await new Promise((resolve, reject) => {
      const socket: any = new net.Socket();
      const client: any = new (jsmodbus as any).client.TCP(
        socket,
        Number(unitId),
      );

      let finished = false;

      const cleanup = (): void => {
        try {
          socket.end();
        } catch {
          // ignore
        }

        try {
          socket.destroy();
        } catch {
          // ignore
        }
      };

      const finishResolve = (result: any): void => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(result);
      };

      const finishReject = (error: any): void => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(error);
      };

      socket.setTimeout(CONFIG.airco.requestTimeoutMs);

      socket.once("error", finishReject);

      socket.once("timeout", () => {
        finishReject(new Error("hopmann socket timeout"));
      });

      socket.once("connect", async () => {
        try {
          if (type === "readInput") {
            const res = await client.readInputRegisters(register, value);
            const out = res?.response?._body?._values?.[0] ?? 0;

            finishResolve(out);
            return;
          }

          if (type === "writeHold") {
            const res = await client.writeSingleRegister(register, value);

            finishResolve(res);
            return;
          }

          const res = await client.readHoldingRegisters(register, value);
          const out = res?.response?._body?._values?.[0] ?? 0;

          finishResolve(out);
        } catch (error) {
          finishReject(error);
        }
      });

      socket.connect({
        host: this.connection.host,
        port: this.connection.port,
      });
    });
  }

  async setSetpoint(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    void zone;

    const type = this.getDeviceType();

    await this.readOrWrite(
      unitId,
      this.tempRegister(type),
      "writeHold",
      Math.round(temperature * 10),
    );
  }

  async setFanSpeed(unitId: number, zone: Zone, speed: number): Promise<void> {
    void zone;

    const type = this.getDeviceType();
    const encoded = this.encodeFanSpeed(type, speed === -1 ? 2 : speed);

    await this.readOrWrite(
      unitId,
      this.fanRegister(type),
      "writeHold",
      encoded,
    );
  }

  async setFanMode(unitId: number, zone: Zone, mode: number): Promise<void> {
    void zone;

    const type = this.getDeviceType();

    if (!this.hasSeparatePowerRegister(type)) {
      return;
    }

    await this.readOrWrite(
      unitId,
      this.powerRegister(type),
      "writeHold",
      mode === 0 ? 0 : 1,
    );
  }

  async getVirtualTemperature(unitId: number, zone: Zone): Promise<number> {
    void zone;

    if (!this.isBidirectional()) {
      return 0;
    }

    const raw = await this.readOrWrite(unitId, 0, "readInput", 1);

    return roundHalf(Number(raw) / 10);
  }
}

/* -------------------------------------------------------------------------- */
/* services/AircoMqttBridge.ts */
/* -------------------------------------------------------------------------- */

class AircoMqttBridge {
  private client?: mqtt.MqttClient;

  private airco = new HopmannAdapter({
    host: CONFIG.airco.host,
    port: CONFIG.airco.port,
    model: CONFIG.airco.model,
    bidirectional: CONFIG.airco.bidirectional,
  });

  private running = true;
  private lastVirtualTempSignature: string | null = null;

  async start(): Promise<void> {
    await this.airco.connect();
    await this.connectMqtt();

    log(`airco mqtt bridge gestart airco=${CONFIG.airco.host}:${CONFIG.airco.port}`);

    void this.virtualTempLoop();
  }

  async stop(): Promise<void> {
    this.running = false;

    try {
      this.client?.end(true);
    } catch {
      // ignore
    }

    await this.airco.disconnect();
  }

  private async connectMqtt(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(CONFIG.mqtt.broker);
      this.client = client;

      client.once("connect", () => {
        log(`airco bridge mqtt verbonden met ${CONFIG.mqtt.broker}`);

        client.subscribe(
          [TOPICS.setTemperatureSet, TOPICS.fanModeSet, TOPICS.fanSpeedSet],
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            log("airco bridge subscribed op command topics");
            resolve();
          },
        );
      });

      client.once("error", reject);

      client.on("error", (error) => {
        log(`airco bridge mqtt error: ${formatError(error)}`);
      });

      client.on("message", (topic, payload) => {
        this.handleMessage(topic, payload).catch((error) => {
          log(`airco bridge message error topic=${topic}: ${formatError(error)}`);
        });
      });
    });
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    const value = toNumber(payload);

    if (value === null) {
      log(`ongeldige mqtt payload topic=${topic} payload=${payload.toString()}`);
      return;
    }

    if (topic === TOPICS.setTemperatureSet) {
      await this.handleSetTemperature(value);
      return;
    }

    if (topic === TOPICS.fanModeSet) {
      await this.handleFanMode(value);
      return;
    }

    if (topic === TOPICS.fanSpeedSet) {
      await this.handleFanSpeed(value);
      return;
    }
  }

  private async handleSetTemperature(value: number): Promise<void> {
    const temperature = round1(value);

    log(`airco ontvangt via mqtt setTemperature=${temperature}`);

    await this.safeWrite(() =>
      this.airco.setSetpoint(CONFIG.airco.unitId, CONFIG.airco.zone, temperature),
    );

    this.publishState(TOPICS.setTemperatureState, temperature);
  }

  private async handleFanMode(value: number): Promise<void> {
    const fanMode = normalizeFanMode(value);

    log(`airco ontvangt via mqtt fanMode=${fanMode}`);

    await this.safeWrite(() =>
      this.airco.setFanMode(CONFIG.airco.unitId, CONFIG.airco.zone, fanMode),
    );

    this.publishState(TOPICS.fanModeState, fanMode);
  }

  private async handleFanSpeed(value: number): Promise<void> {
    log(`airco ontvangt via mqtt fanSpeed=${value}`);

    await this.safeWrite(() =>
      this.airco.setFanSpeed(CONFIG.airco.unitId, CONFIG.airco.zone, value),
    );

    this.publishState(TOPICS.fanSpeedState, value);
  }

  private async virtualTempLoop(): Promise<void> {
    while (this.running) {
      try {
        const value = await this.airco.getVirtualTemperature(
          CONFIG.airco.unitId,
          CONFIG.airco.zone,
        );

        const rounded = roundHalf(value);
        const signature = virtualTempSignature(rounded);

        if (signature !== this.lastVirtualTempSignature) {
          this.lastVirtualTempSignature = signature;
          this.publishState(TOPICS.virtualTempState, rounded);
        }
      } catch (error) {
        log(`airco virtualTemp lezen mislukt: ${formatError(error)}`);
      }

      await sleep(CONFIG.airco.virtualTempPollIntervalMs);
    }
  }

  private publishState(topic: string, value: number): void {
    this.client?.publish(topic, String(value), {
      retain: CONFIG.mqtt.retainStates,
    });

    log(`mqtt state publish ${topic}=${value}`);
  }

  private async safeWrite(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      if (isTimeoutError(error)) {
        log("airco write timeout, mogelijk wel aangekomen");
        return;
      }

      log(`airco write error: ${formatError(error)}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* controllers/ControlHttpServer.ts */
/* -------------------------------------------------------------------------- */

class ControlHttpServer {
  private server?: Server;
  private client?: mqtt.MqttClient;
  private mqttConnected = false;
  private state: Record<string, { value: number; updatedAt: string }> = {};
  private configStore: ConfigStore;
  private polarbearAdmin?: PolarbearAdminController;

  constructor(configStore: ConfigStore, polarbearAdmin?: PolarbearAdminController) {
    this.configStore = configStore;
    this.polarbearAdmin = polarbearAdmin;
  }

  async start(): Promise<void> {
    await this.connectMqtt();

    this.server = createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        log(`control http error: ${formatError(error)}`);
        this.sendJson(response, 500, {
          ok: false,
          error: formatError(error),
          message: formatError(error),
        });
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(CONFIG.control.port, CONFIG.control.host, () => {
        log(
          `control frontend gestart http://${CONFIG.control.host}:${CONFIG.control.port}`,
        );
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    try {
      this.client?.end(true);
    } catch {
      // ignore
    }

    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });
  }

  private async connectMqtt(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(CONFIG.mqtt.broker);
      this.client = client;

      client.once("connect", () => {
        this.mqttConnected = true;
        log(`control mqtt verbonden met ${CONFIG.mqtt.broker}`);

        client.subscribe(
          [
            TOPICS.setTemperatureState,
            TOPICS.fanModeState,
            TOPICS.fanSpeedState,
            TOPICS.virtualTempState,
          ],
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          },
        );
      });

      client.once("error", reject);

      client.on("close", () => {
        this.mqttConnected = false;
      });

      client.on("reconnect", () => {
        this.mqttConnected = false;
      });

      client.on("error", (error) => {
        log(`control mqtt error: ${formatError(error)}`);
      });

      client.on("message", (topic, payload) => {
        const value = toNumber(payload);

        if (value === null) {
          return;
        }

        this.state[topic] = {
          value,
          updatedAt: new Date().toISOString(),
        };
      });
    });
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    this.applyCors(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/") {
      this.sendJson(response, 200, {
        ok: true,
        message: "WallpanelAircoSync backend actief. Gebruik de React frontend uit frontend/.",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/status") {
      this.sendJson(response, 200, {
        ok: true,
        mqttConnected: this.mqttConnected,
        broker: CONFIG.mqtt.broker,
        topics: TOPICS,
        state: this.readableState(),
        polarbearLoop: this.polarbearAdmin?.getPolarbearLoopStatus() ?? null,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/settings") {
      this.sendJson(response, 200, {
        ok: true,
        settings: await this.configStore.getSettings(),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/devices") {
      this.sendJson(response, 200, await this.configStore.getFrontendZones());
      return;
    }

    if (request.method === "GET" && url.pathname === "/environment-devices") {
      this.sendJson(response, 200, await this.configStore.getEnvironmentDevices());
      return;
    }

    if (request.method === "POST" && url.pathname === "/environment-devices") {
      this.sendJson(
        response,
        201,
        await this.configStore.addEnvironmentDevice(
          await this.readJsonRequest<Partial<EnvironmentAircoDeviceDocument>>(request),
        ),
      );
      return;
    }

    const environmentDeviceMatch = url.pathname.match(/^\/environment-devices\/([^/]+)$/);
    if (environmentDeviceMatch && request.method === "PUT") {
      this.sendJson(
        response,
        200,
        await this.configStore.updateEnvironmentDevice(
          decodeURIComponent(environmentDeviceMatch[1]),
          await this.readJsonRequest<Partial<EnvironmentAircoDeviceDocument>>(request),
        ),
      );
      return;
    }

    if (environmentDeviceMatch && request.method === "DELETE") {
      await this.configStore.deleteEnvironmentDevice(
        decodeURIComponent(environmentDeviceMatch[1]),
      );
      this.sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/airco-adapter-types") {
      this.sendJson(response, 200, [{ type: "HeinAndHopmanIpSystem" }]);
      return;
    }

    if (request.method === "POST" && url.pathname === "/devices") {
      this.sendJson(
        response,
        201,
        await this.configStore.addPanel(
          await this.readJsonRequest<Partial<DbAircoPanel> & { zoneId: string; roomId: string }>(request),
        ),
      );
      return;
    }

    const panelMatch = url.pathname.match(/^\/devices\/([^/]+)$/);
    if (panelMatch && request.method === "PUT") {
      this.sendJson(
        response,
        200,
        await this.configStore.updatePanel(
          decodeURIComponent(panelMatch[1]),
          await this.readJsonRequest<Partial<DbAircoPanel>>(request),
        ),
      );
      return;
    }

    if (panelMatch && request.method === "DELETE") {
      await this.configStore.deletePanel(decodeURIComponent(panelMatch[1]));
      this.sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/airco-devices") {
      this.sendJson(
        response,
        201,
        await this.configStore.addAirconditioner(
          await this.readJsonRequest<Partial<DbAirconditioner> & { zoneId: string; roomId: string }>(request),
        ),
      );
      return;
    }

    const aircoDeviceMatch = url.pathname.match(/^\/airco-devices\/([^/]+)$/);
    if (aircoDeviceMatch && request.method === "PUT") {
      this.sendJson(
        response,
        200,
        await this.configStore.updateAirconditioner(
          decodeURIComponent(aircoDeviceMatch[1]),
          await this.readJsonRequest<Partial<DbAirconditioner>>(request),
        ),
      );
      return;
    }

    if (aircoDeviceMatch && request.method === "DELETE") {
      await this.configStore.deleteAirconditioner(decodeURIComponent(aircoDeviceMatch[1]));
      this.sendJson(response, 200, { ok: true });
      return;
    }

    const wallpanelInsightsMatch = url.pathname.match(
      /^\/wallpanel-insights\/rooms\/([^/]+)\/([^/]+)$/,
    );
    if (wallpanelInsightsMatch && request.method === "GET") {
      this.sendJson(response, 200, await this.wallpanelInsightsResponse());
      return;
    }

    const wallpanelStreamMatch = url.pathname.match(
      /^\/wallpanel-insights\/stream\/rooms\/([^/]+)\/([^/]+)$/,
    );
    if (wallpanelStreamMatch && request.method === "GET") {
      await this.streamInsights(response, "insights", () => this.wallpanelInsightsResponse());
      return;
    }

    if (request.method === "GET" && url.pathname === "/wallpanel-insights/sync/status") {
      this.sendJson(response, 200, {
        polarbearLoop: {
          ...(this.polarbearAdmin?.getPolarbearLoopStatus() ?? { paused: false }),
          running: !(this.polarbearAdmin?.getPolarbearLoopStatus().paused ?? false),
        },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/wallpanel-insights/sync/pause") {
      const polarbearAdmin = this.getPolarbearAdmin();
      await polarbearAdmin.pausePolarbearLoop();
      this.sendJson(response, 200, {
        polarbearLoop: { ...polarbearAdmin.getPolarbearLoopStatus(), running: false },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/wallpanel-insights/sync/resume") {
      const polarbearAdmin = this.getPolarbearAdmin();
      await polarbearAdmin.resumePolarbearLoop();
      this.sendJson(response, 200, {
        polarbearLoop: { ...polarbearAdmin.getPolarbearLoopStatus(), running: true },
      });
      return;
    }

    const wallpanelRebootMatch = url.pathname.match(
      /^\/wallpanel-insights\/panels\/([^/]+)\/reboot$/,
    );
    if (wallpanelRebootMatch && request.method === "POST") {
      const polarbearAdmin = this.getPolarbearAdmin();
      this.assertPolarbearLoopPaused(polarbearAdmin);
      const { unitIds } = await this.readPolarbearAdminRequest(request, url);
      await polarbearAdmin.rebootPolarbears(unitIds);
      this.sendJson(response, 202, { ok: true, unitIds });
      return;
    }

    const wallpanelBaudrateMatch = url.pathname.match(
      /^\/wallpanel-insights\/panels\/([^/]+)\/baudrate$/,
    );
    if (wallpanelBaudrateMatch && request.method === "POST") {
      const polarbearAdmin = this.getPolarbearAdmin();
      this.assertPolarbearLoopPaused(polarbearAdmin);
      const { unitIds, baudrate } = await this.readPolarbearAdminRequest(request, url);

      if (!baudrate || BAUDRATE_VALUES[baudrate] === undefined) {
        throw new Error(
          `Unsupported baudrate: ${baudrate}. Supported: ${Object.keys(BAUDRATE_VALUES).join(", ")}`,
        );
      }

      await polarbearAdmin.setPolarbearBaudrate(unitIds, baudrate);
      this.sendJson(response, 202, { ok: true, unitIds, baudrate });
      return;
    }

    const aircoInsightsMatch = url.pathname.match(
      /^\/airco-insights\/rooms\/([^/]+)\/([^/]+)$/,
    );
    if (aircoInsightsMatch && request.method === "GET") {
      this.sendJson(response, 200, await this.aircoInsightsResponse());
      return;
    }

    const aircoStreamMatch = url.pathname.match(
      /^\/airco-insights\/stream\/rooms\/([^/]+)\/([^/]+)$/,
    );
    if (aircoStreamMatch && request.method === "GET") {
      await this.streamInsights(response, "insights", () => this.aircoInsightsResponse());
      return;
    }

    const aircoCommandMatch = url.pathname.match(
      /^\/airco-insights\/rooms\/([^/]+)\/([^/]+)\/aircos\/([^/]+)\/commands$/,
    );
    if (aircoCommandMatch && request.method === "POST") {
      await this.handleFrontendAircoCommand(request);
      this.sendJson(response, 202, { ok: true });
      return;
    }

    if (
      (request.method === "PATCH" || request.method === "PUT") &&
      url.pathname === "/api/settings"
    ) {
      const patch = await this.readJsonRequest<SettingsPatch>(request);
      const settings = await this.configStore.updateSettings(patch);

      this.sendJson(response, 200, {
        ok: true,
        settings,
        restartRequired: true,
      });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/polarbears/reboot"
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();

      this.assertPolarbearLoopPaused(polarbearAdmin);
      const { unitIds } = await this.readPolarbearAdminRequest(request, url);
      await polarbearAdmin.rebootPolarbears(unitIds);

      this.sendJson(response, 202, {
        ok: true,
        command: "polarbearReboot",
        unitIds,
      });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/polarbears/baudrate"
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();

      this.assertPolarbearLoopPaused(polarbearAdmin);
      const { unitIds, baudrate } = await this.readPolarbearAdminRequest(
        request,
        url,
      );

      if (!baudrate) {
        throw new Error(
          `missing baudrate. Supported: ${Object.keys(BAUDRATE_VALUES).join(", ")}`,
        );
      }

      if (BAUDRATE_VALUES[baudrate] === undefined) {
        throw new Error(
          `Unsupported baudrate: ${baudrate}. Supported: ${Object.keys(
            BAUDRATE_VALUES,
          ).join(", ")}`,
        );
      }

      await polarbearAdmin.setPolarbearBaudrate(unitIds, baudrate);

      this.sendJson(response, 202, {
        ok: true,
        command: "polarbearBaudrate",
        unitIds,
        baudrate,
      });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/polarbears/pause"
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();

      await polarbearAdmin.pausePolarbearLoop();

      this.sendJson(response, 200, {
        ok: true,
        command: "polarbearLoopPause",
        polarbearLoop: polarbearAdmin.getPolarbearLoopStatus(),
      });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/polarbears/resume"
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();

      await polarbearAdmin.resumePolarbearLoop();

      this.sendJson(response, 200, {
        ok: true,
        command: "polarbearLoopResume",
        polarbearLoop: polarbearAdmin.getPolarbearLoopStatus(),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/setpoint") {
      const value = await this.readNumberFromRequest(request, url);
      const temperature = round1(value);

      await this.publishCommand(TOPICS.setTemperatureSet, temperature);
      this.sendJson(response, 202, {
        ok: true,
        command: "setpoint",
        value: temperature,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/fan-mode") {
      const value = normalizeFanMode(await this.readNumberFromRequest(request, url));

      await this.publishCommand(TOPICS.fanModeSet, value);
      this.sendJson(response, 202, {
        ok: true,
        command: "fanMode",
        value,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/fan-speed") {
      const value = Math.round(await this.readNumberFromRequest(request, url));

      await this.publishCommand(TOPICS.fanSpeedSet, value);
      this.sendJson(response, 202, {
        ok: true,
        command: "fanSpeed",
        value,
      });
      return;
    }

    this.sendJson(response, 404, { ok: false, error: "not found" });
  }

  private async wallpanelInsightsResponse(): Promise<unknown> {
    const settings = await this.configStore.getSettings();
    const state = this.readableState();

    return {
      roomName: settings.roomName,
      generatedAt: new Date().toISOString(),
      panels: [
        {
          panelId: settings.wallpanel.id,
          name: settings.wallpanel.name,
          ip: settings.wallpanel.host,
          port: settings.wallpanel.port,
          type: settings.wallpanel.units[0]?.type,
          terminalIds: settings.wallpanel.units.map((unit) => unit.id),
          status: "ok",
          error: null,
          units: settings.wallpanel.units.map((unit) => ({
            unitId: unit.id,
            zones: unit.zones.map((zone) => ({
              zone,
              status: "ok",
              setpoint: state.setpoint?.value,
              virtualTemperature: state.virtualTemp?.value,
              fanSpeed: state.fanSpeed?.value,
              fanMode: state.fanMode?.value,
            })),
          })),
        },
      ],
    };
  }

  private async aircoInsightsResponse(): Promise<unknown> {
    const settings = await this.configStore.getSettings();
    const state = this.readableState();

    return {
      zoneId: settings.climatezoneId,
      roomId: settings.roomId,
      roomName: settings.roomName,
      generatedAt: new Date().toISOString(),
      aircos: [
        {
          aircoId: settings.airco.airconditionerId,
          name: settings.airco.name,
          deviceType: settings.airco.model,
          adapterType: "HeinAndHopmanIpSystem",
          environmentDeviceId: settings.airco.deviceId,
          unitId: settings.airco.unitId,
          commands: ["setpoint", "fanSpeed", "fanMode"],
          zones: [
            {
              zone: CONFIG.airco.zone,
              status: "ok",
              setpoint: state.setpoint?.value,
              virtualTemperature: state.virtualTemp?.value,
              fanSpeed: state.fanSpeed?.value,
              fanMode: state.fanMode?.value,
              updatedAt:
                state.setpoint?.updatedAt ??
                state.virtualTemp?.updatedAt ??
                state.fanSpeed?.updatedAt ??
                state.fanMode?.updatedAt ??
                null,
              commands: ["setpoint", "fanSpeed", "fanMode"],
            },
          ],
        },
      ],
    };
  }

  private async streamInsights(
    response: ServerResponse,
    eventName: string,
    buildPayload: () => Promise<unknown>,
  ): Promise<void> {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = async () => {
      try {
        response.write(`event: ${eventName}\n`);
        response.write(`data: ${JSON.stringify(await buildPayload())}\n\n`);
      } catch (error) {
        response.write("event: insights-error\n");
        response.write(`data: ${JSON.stringify({ message: formatError(error) })}\n\n`);
      }
    };

    await send();
    const interval = setInterval(() => {
      void send();
    }, 2500);

    response.on("close", () => clearInterval(interval));
  }

  private async handleFrontendAircoCommand(request: IncomingMessage): Promise<void> {
    const body = await this.readJsonRequest<{
      property?: string;
      value?: unknown;
      zone?: unknown;
    }>(request);
    const value = Number(body.value);

    if (!Number.isFinite(value)) {
      throw new Error("missing numeric value");
    }

    if (body.property === "setpoint") {
      await this.publishCommand(TOPICS.setTemperatureSet, round1(value));
      return;
    }

    if (body.property === "fanMode") {
      await this.publishCommand(TOPICS.fanModeSet, normalizeFanMode(value));
      return;
    }

    if (body.property === "fanSpeed") {
      await this.publishCommand(TOPICS.fanSpeedSet, Math.round(value));
      return;
    }

    throw new Error(`unsupported command property: ${body.property}`);
  }

  private readableState(): Record<string, { value: number; updatedAt: string } | null> {
    return {
      setpoint: this.state[TOPICS.setTemperatureState] ?? null,
      fanMode: this.state[TOPICS.fanModeState] ?? null,
      fanSpeed: this.state[TOPICS.fanSpeedState] ?? null,
      virtualTemp: this.state[TOPICS.virtualTempState] ?? null,
    };
  }

  private getPolarbearAdmin(): PolarbearAdminController {
    if (!this.polarbearAdmin) {
      throw new Error("polarbear admin is niet actief in deze runMode");
    }

    return this.polarbearAdmin;
  }

  private assertPolarbearLoopPaused(
    polarbearAdmin: PolarbearAdminController,
  ): void {
    if (!polarbearAdmin.getPolarbearLoopStatus().paused) {
      throw new Error(
        "zet eerst de polarbear poll-loop op pauze voordat je reboot of baudrate wijzigt",
      );
    }
  }

  private async readPolarbearAdminRequest(
    request: IncomingMessage,
    url: URL,
  ): Promise<{ unitIds: number[]; baudrate?: number }> {
    const rawBody = await this.readBody(request);
    const body = rawBody.trim()
      ? (JSON.parse(rawBody) as Record<string, unknown>)
      : {};

    const settings = await this.configStore.getSettings();
    const configuredUnitIds = settings.wallpanel.units.map((unit) => unit.id);
    const unitIds = this.parseUnitIds(
      body.unitIds ??
        body.ids ??
        url.searchParams.get("unitIds") ??
        url.searchParams.get("ids"),
      configuredUnitIds,
    );
    const unknownUnitIds = unitIds.filter(
      (unitId) => !configuredUnitIds.includes(unitId),
    );

    if (unknownUnitIds.length > 0) {
      throw new Error(
        `onbekende polarbear unit-id(s): ${unknownUnitIds.join(", ")}`,
      );
    }

    return {
      unitIds,
      baudrate: this.parseOptionalNumber(
        body.baudrate ??
          body.baudRate ??
          body.value ??
          url.searchParams.get("baudrate") ??
          url.searchParams.get("baudRate") ??
          url.searchParams.get("value"),
      ),
    };
  }

  private parseUnitIds(value: unknown, fallback: number[]): number[] {
    const rawValues =
      value === undefined || value === null || value === ""
        ? fallback
        : Array.isArray(value)
          ? value
          : String(value).split(",");

    const unitIds = rawValues
      .map((unitId) => Number(unitId))
      .filter((unitId) => Number.isFinite(unitId) && unitId > 0)
      .map((unitId) => Math.round(unitId));
    const uniqueUnitIds = Array.from(new Set(unitIds));

    if (uniqueUnitIds.length === 0) {
      throw new Error("geen geldige polarbear unit-ids opgegeven");
    }

    return uniqueUnitIds;
  }

  private parseOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  private async readNumberFromRequest(
    request: IncomingMessage,
    url: URL,
  ): Promise<number> {
    const queryValue =
      url.searchParams.get("value") ??
      url.searchParams.get("temperature") ??
      url.searchParams.get("setpoint");

    if (queryValue !== null) {
      const parsed = Number(queryValue);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const rawBody = await this.readBody(request);
    const text = rawBody.trim();

    if (!text) {
      throw new Error("missing numeric value");
    }

    const directNumber = Number(text);

    if (Number.isFinite(directNumber)) {
      return directNumber;
    }

    let json: unknown;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("body must be JSON or a number");
    }

    const value = parseCommandNumber(json);

    if (value === null) {
      throw new Error("missing numeric value");
    }

    return value;
  }

  private async readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;

      if (total > CONFIG.control.requestBodyLimitBytes) {
        throw new Error("request body too large");
      }

      chunks.push(buffer);
    }

    return Buffer.concat(chunks).toString("utf8");
  }

  private async readJsonRequest<T>(request: IncomingMessage): Promise<T> {
    const rawBody = await this.readBody(request);

    if (!rawBody.trim()) {
      throw new Error("missing JSON body");
    }

    return JSON.parse(rawBody) as T;
  }

  private async publishCommand(topic: string, value: number): Promise<void> {
    if (!this.client || !this.mqttConnected) {
      throw new Error("mqtt is not connected");
    }

    await new Promise<void>((resolve, reject) => {
      this.client?.publish(
        topic,
        String(value),
        { retain: CONFIG.mqtt.retainCommands },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          log(`control mqtt command ${topic}=${value}`);
          resolve();
        },
      );
    });
  }

  private applyCors(response: ServerResponse): void {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  private sendJson(
    response: ServerResponse,
    statusCode: number,
    payload: unknown,
  ): void {
    if (response.headersSent) {
      return;
    }

    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload, null, 2));
  }

  private sendHtml(response: ServerResponse, html: string): void {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  }

  private renderFrontend(): string {
    return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Airco bediening</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f3;
      color: #1d2521;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f6f7f3; }
    main { width: min(920px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 40px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 46px); line-height: 1; font-weight: 800; letter-spacing: 0; }
    .status { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 12px; border: 1px solid #cfd8d2; border-radius: 999px; background: #ffffff; font-size: 14px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #9aa39d; }
    .dot.online { background: #15803d; }
    .panel { background: #ffffff; border: 1px solid #d8ded9; border-radius: 8px; padding: 22px; box-shadow: 0 12px 30px rgba(29, 37, 33, 0.08); }
    .grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 18px; }
    .temperature { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; }
    label { display: block; color: #526158; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
    input, select { width: 100%; min-height: 44px; border: 1px solid #b9c5bd; border-radius: 8px; padding: 0 12px; font: inherit; color: #10251a; background: #fbfcfa; }
    input[type="number"].large { min-height: 70px; padding: 0 16px; font-size: 34px; font-weight: 800; }
    button { min-height: 44px; border: 0; border-radius: 8px; padding: 0 16px; font: inherit; font-weight: 800; cursor: pointer; background: #1f6f50; color: #ffffff; }
    button.secondary { background: #e6ece8; color: #173126; }
    button:disabled { opacity: 0.55; cursor: wait; }
    .stepper { display: grid; grid-template-columns: 44px 44px; gap: 8px; }
    .stepper button { padding: 0; font-size: 22px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    .segmented { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
    .stat { min-height: 82px; border: 1px solid #d8ded9; border-radius: 8px; padding: 12px; background: #fbfcfa; }
    .stat span { display: block; color: #526158; font-size: 12px; font-weight: 700; }
    .stat strong { display: block; margin-top: 7px; font-size: 22px; color: #10251a; }
    .settings { margin-top: 18px; padding-top: 18px; border-top: 1px solid #d8ded9; }
    .settings h2 { margin: 0 0 14px; font-size: 18px; line-height: 1.2; }
    .settings-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .unit-list { display: grid; gap: 10px; margin-top: 12px; }
    .unit-row { display: grid; grid-template-columns: 0.6fr 1fr 1.2fr; gap: 10px; }
    .admin { margin-top: 18px; padding-top: 18px; border-top: 1px solid #d8ded9; }
    .admin h2 { margin: 0 0 14px; font-size: 18px; line-height: 1.2; }
    .admin-grid { display: grid; grid-template-columns: 1.2fr 0.8fr auto auto; gap: 12px; align-items: end; }
    .check-list { display: flex; flex-wrap: wrap; gap: 8px; min-height: 44px; align-items: center; }
    .check-item { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 10px; border: 1px solid #b9c5bd; border-radius: 8px; background: #fbfcfa; font-size: 14px; font-weight: 700; color: #10251a; }
    .check-item input { width: auto; min-height: auto; }
    .toast { min-height: 22px; margin-top: 14px; color: #526158; font-size: 14px; }
    @media (max-width: 720px) {
      main { width: min(100vw - 20px, 920px); padding-top: 18px; }
      header { align-items: start; flex-direction: column; }
      .grid, .stats, .settings-grid, .unit-row, .admin-grid { grid-template-columns: 1fr; }
      .temperature { grid-template-columns: 1fr; }
      .stepper { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Airco</h1>
      <div class="status"><span id="dot" class="dot"></span><span id="mqttStatus">MQTT</span></div>
    </header>
    <section class="panel">
      <div class="grid">
        <form id="setpointForm">
          <label for="setpoint">Setpoint</label>
          <div class="temperature">
            <input id="setpoint" class="large" name="setpoint" type="number" min="5" max="35" step="0.5" value="21.0">
            <div class="stepper">
              <button class="secondary" type="button" data-step="-0.5">-</button>
              <button class="secondary" type="button" data-step="0.5">+</button>
            </div>
          </div>
          <div class="actions">
            <button id="sendSetpoint" type="submit">Setpoint sturen</button>
          </div>
        </form>
        <div>
          <label>Power</label>
          <div class="segmented">
            <button type="button" data-fan-mode="1">Aan</button>
            <button class="secondary" type="button" data-fan-mode="0">Uit</button>
          </div>
          <div style="height:14px"></div>
          <label for="fanSpeed">Fan speed</label>
          <input id="fanSpeed" type="number" min="-1" max="5" step="1" value="2">
          <div class="actions">
            <button id="sendFanSpeed" class="secondary" type="button">Fan sturen</button>
          </div>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><span>Setpoint</span><strong id="stateSetpoint">-</strong></div>
        <div class="stat"><span>Power</span><strong id="stateFanMode">-</strong></div>
        <div class="stat"><span>Fan</span><strong id="stateFanSpeed">-</strong></div>
        <div class="stat"><span>Ruimte</span><strong id="stateVirtualTemp">-</strong></div>
      </div>
      <form id="settingsForm" class="settings">
        <h2>Instellingen</h2>
        <div class="settings-grid">
          <div>
            <label for="panelHost">Panel IP</label>
            <input id="panelHost" name="panelHost" type="text">
          </div>
          <div>
            <label for="panelPort">Panel poort</label>
            <input id="panelPort" name="panelPort" type="number" min="1" max="65535">
          </div>
          <div>
            <label for="aircoHost">Airco IP</label>
            <input id="aircoHost" name="aircoHost" type="text">
          </div>
          <div>
            <label for="aircoPort">Airco poort</label>
            <input id="aircoPort" name="aircoPort" type="number" min="1" max="65535">
          </div>
          <div>
            <label for="aircoModel">Airco model</label>
            <select id="aircoModel" name="aircoModel">
              <option value="FC-500PC/FC-1100PC">FC-500PC/FC-1100PC</option>
              <option value="FC-3000DC/FC-3500DC">FC-3000DC/FC-3500DC</option>
            </select>
          </div>
          <div>
            <label for="aircoUnitId">Airco unit-id</label>
            <input id="aircoUnitId" name="aircoUnitId" type="number" min="1" max="255">
          </div>
          <div>
            <label for="aircoBidirectional">Bidirectional</label>
            <select id="aircoBidirectional" name="aircoBidirectional">
              <option value="true">Ja</option>
              <option value="false">Nee</option>
            </select>
          </div>
        </div>
        <div id="unitSettings" class="unit-list"></div>
        <div class="actions">
          <button id="saveSettings" class="secondary" type="submit">Instellingen opslaan</button>
        </div>
      </form>
      <section class="admin">
        <h2>Polarbears <span id="polarbearLoopStatus" style="font-size:13px;color:#526158;font-weight:700"></span></h2>
        <div class="admin-grid">
          <div>
            <label>Units</label>
            <div id="adminUnits" class="check-list"></div>
          </div>
          <div>
            <label for="baudrate">Baudrate</label>
            <select id="baudrate">
              <option value="9600">9600</option>
              <option value="19200">19200</option>
              <option value="57600">57600</option>
              <option value="115200">115200</option>
            </select>
          </div>
          <button id="setBaudrate" class="secondary" type="button">Baudrate zetten</button>
          <button id="rebootPolarbears" type="button">Reboot</button>
        </div>
        <div class="actions">
          <button id="pausePolarbearLoop" class="secondary" type="button">Poll pauzeren</button>
          <button id="resumePolarbearLoop" class="secondary" type="button">Poll hervatten</button>
        </div>
      </section>
      <div id="toast" class="toast"></div>
    </section>
  </main>
  <script>
    const form = document.querySelector("#setpointForm");
    const settingsForm = document.querySelector("#settingsForm");
    const setpoint = document.querySelector("#setpoint");
    const fanSpeed = document.querySelector("#fanSpeed");
    const toast = document.querySelector("#toast");
    const dot = document.querySelector("#dot");
    const mqttStatus = document.querySelector("#mqttStatus");
    const unitSettings = document.querySelector("#unitSettings");
    const adminUnits = document.querySelector("#adminUnits");
    const buttons = Array.from(document.querySelectorAll("button"));
    let currentSettings = null;

    const setBusy = (busy) => buttons.forEach((button) => button.disabled = busy);
    const show = (message) => { toast.textContent = message; };
    const valueText = (entry, suffix = "") => entry ? entry.value + suffix : "-";

    async function post(path, value) {
      setBusy(true);
      try {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "request failed");
        show("Verstuurd: " + json.command + " " + json.value);
        await refresh();
      } catch (error) {
        show("Mislukt: " + error.message);
      } finally {
        setBusy(false);
      }
    }

    async function refresh() {
      const response = await fetch("/api/status");
      const json = await response.json();
      dot.classList.toggle("online", Boolean(json.mqttConnected));
      mqttStatus.textContent = json.mqttConnected ? "MQTT online" : "MQTT offline";
      document.querySelector("#stateSetpoint").textContent = valueText(json.state.setpoint, " C");
      document.querySelector("#stateFanMode").textContent = json.state.fanMode ? (json.state.fanMode.value === 0 ? "Uit" : "Aan") : "-";
      document.querySelector("#stateFanSpeed").textContent = valueText(json.state.fanSpeed);
      document.querySelector("#stateVirtualTemp").textContent = valueText(json.state.virtualTemp, " C");
      document.querySelector("#polarbearLoopStatus").textContent = json.polarbearLoop?.paused ? "poll gepauzeerd" : "poll actief";
      document.querySelector("#setBaudrate").disabled = !json.polarbearLoop?.paused;
      document.querySelector("#rebootPolarbears").disabled = !json.polarbearLoop?.paused;
    }

    function unitField(name, value, type, labelText) {
      const wrap = document.createElement("div");
      const label = document.createElement("label");
      const input = document.createElement(type === "select" ? "select" : "input");
      label.textContent = labelText;
      if (type === "select") {
        ["polarbear-v1", "polarbear-v3"].forEach((optionValue) => {
          const option = document.createElement("option");
          option.value = optionValue;
          option.textContent = optionValue;
          input.appendChild(option);
        });
      } else {
        input.type = type;
      }
      input.name = name;
      input.value = value;
      wrap.appendChild(label);
      wrap.appendChild(input);
      return wrap;
    }

    function renderUnitSettings(units) {
      unitSettings.textContent = "";
      units.forEach((unit, index) => {
        const row = document.createElement("div");
        row.className = "unit-row";
        row.dataset.index = String(index);
        row.appendChild(unitField("id", unit.id, "number", "Unit-id"));
        row.appendChild(unitField("name", unit.name, "text", "Naam"));
        row.appendChild(unitField("type", unit.type, "select", "Polarbear versie"));
        unitSettings.appendChild(row);
      });
    }

    function renderAdminUnits(units) {
      adminUnits.textContent = "";
      units.forEach((unit) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        const text = document.createElement("span");
        label.className = "check-item";
        input.type = "checkbox";
        input.value = unit.id;
        input.checked = true;
        text.textContent = unit.name + " (" + unit.id + ")";
        label.appendChild(input);
        label.appendChild(text);
        adminUnits.appendChild(label);
      });
    }

    async function loadSettings() {
      const response = await fetch("/api/settings");
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "settings failed");

      currentSettings = json.settings;
      document.querySelector("#panelHost").value = currentSettings.wallpanel.host;
      document.querySelector("#panelPort").value = currentSettings.wallpanel.port;
      document.querySelector("#aircoHost").value = currentSettings.airco.host;
      document.querySelector("#aircoPort").value = currentSettings.airco.port;
      document.querySelector("#aircoModel").value = currentSettings.airco.model;
      document.querySelector("#aircoUnitId").value = currentSettings.airco.unitId;
      document.querySelector("#aircoBidirectional").value = String(currentSettings.airco.bidirectional);
      renderUnitSettings(currentSettings.wallpanel.units);
      renderAdminUnits(currentSettings.wallpanel.units);
    }

    function selectedAdminUnitIds() {
      const unitIds = Array.from(adminUnits.querySelectorAll("input:checked")).map((input) => Number(input.value));
      if (unitIds.length === 0) throw new Error("Selecteer minimaal een unit");
      return unitIds;
    }

    async function postPolarbearAdmin(path, body, successText) {
      setBusy(true);
      try {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "request failed");
        show(successText + ": " + json.unitIds.join(", "));
      } catch (error) {
        show("Mislukt: " + error.message);
      } finally {
        setBusy(false);
        await refresh();
      }
    }

    async function postPolarbearLoop(path, successText) {
      setBusy(true);
      try {
        const response = await fetch(path, { method: "POST" });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "request failed");
        show(successText);
      } catch (error) {
        show("Mislukt: " + error.message);
      } finally {
        setBusy(false);
        await refresh();
      }
    }

    async function saveSettings(event) {
      event.preventDefault();
      setBusy(true);
      try {
        const units = Array.from(document.querySelectorAll(".unit-row")).map((row) => ({
          id: Number(row.querySelector("[name=id]").value),
          name: row.querySelector("[name=name]").value,
          type: row.querySelector("[name=type]").value,
          zones: [1],
        }));
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallpanel: {
              host: document.querySelector("#panelHost").value,
              port: Number(document.querySelector("#panelPort").value),
              units,
            },
            airco: {
              host: document.querySelector("#aircoHost").value,
              port: Number(document.querySelector("#aircoPort").value),
              model: document.querySelector("#aircoModel").value,
              unitId: Number(document.querySelector("#aircoUnitId").value),
              bidirectional: document.querySelector("#aircoBidirectional").value === "true",
            },
          }),
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "settings save failed");
        currentSettings = json.settings;
        renderAdminUnits(currentSettings.wallpanel.units);
        show("Instellingen opgeslagen. Herstart de sync om nieuwe verbindingen te gebruiken.");
      } catch (error) {
        show("Opslaan mislukt: " + error.message);
      } finally {
        setBusy(false);
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      post("/api/setpoint", Number(setpoint.value));
    });

    document.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        setpoint.value = (Math.round((Number(setpoint.value) + Number(button.dataset.step)) * 2) / 2).toFixed(1);
      });
    });

    document.querySelectorAll("[data-fan-mode]").forEach((button) => {
      button.addEventListener("click", () => post("/api/fan-mode", Number(button.dataset.fanMode)));
    });

    document.querySelector("#sendFanSpeed").addEventListener("click", () => {
      post("/api/fan-speed", Number(fanSpeed.value));
    });

    document.querySelector("#pausePolarbearLoop").addEventListener("click", () => {
      postPolarbearLoop("/api/polarbears/pause", "Polarbear poll gepauzeerd");
    });

    document.querySelector("#resumePolarbearLoop").addEventListener("click", () => {
      postPolarbearLoop("/api/polarbears/resume", "Polarbear poll hervat");
    });

    document.querySelector("#setBaudrate").addEventListener("click", () => {
      try {
        const unitIds = selectedAdminUnitIds();
        const baudrate = Number(document.querySelector("#baudrate").value);
        if (!confirm("Baudrate " + baudrate + " zetten voor units " + unitIds.join(", ") + "?")) return;
        postPolarbearAdmin(
          "/api/polarbears/baudrate",
          { unitIds, baudrate },
          "Baudrate gezet"
        );
      } catch (error) {
        show("Mislukt: " + error.message);
      }
    });

    document.querySelector("#rebootPolarbears").addEventListener("click", () => {
      try {
        const unitIds = selectedAdminUnitIds();
        if (!confirm("Reboot units " + unitIds.join(", ") + "?")) return;
        postPolarbearAdmin(
          "/api/polarbears/reboot",
          { unitIds },
          "Reboot gestart"
        );
      } catch (error) {
        show("Mislukt: " + error.message);
      }
    });

    settingsForm.addEventListener("submit", saveSettings);

    refresh();
    loadSettings().catch((error) => show("Instellingen laden mislukt: " + error.message));
    setInterval(refresh, 2500);
  </script>
</body>
</html>`;
  }
}

/* -------------------------------------------------------------------------- */
/* services/PolarbearMqttClient.ts */
/* -------------------------------------------------------------------------- */

class PolarbearMqttClient {
  private client?: mqtt.MqttClient;
  private handlers: PolarbearMqttHandlers;

  constructor(handlers: PolarbearMqttHandlers) {
    this.handlers = handlers;
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(CONFIG.mqtt.broker);
      this.client = client;

      client.once("connect", () => {
        log(`polarbear mqtt verbonden met ${CONFIG.mqtt.broker}`);

        client.subscribe(
          [
            TOPICS.virtualTempState,
            TOPICS.setTemperatureState,
            TOPICS.fanModeState,
            TOPICS.fanSpeedState,
            TOPICS.setTemperatureSet,
            TOPICS.fanModeSet,
            TOPICS.fanSpeedSet,
          ],
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            log("polarbear mqtt subscribed op state en command topics");
            resolve();
          },
        );
      });

      client.once("error", reject);

      client.on("error", (error) => {
        log(`polarbear mqtt error: ${formatError(error)}`);
      });

      client.on("message", (topic, payload) => {
        this.handleMessage(topic, payload);
      });
    });
  }

  close(): void {
    try {
      this.client?.end(true);
    } catch {
      // ignore
    }
  }

  publishSetTemperatureCommand(value: number): void {
    this.publishCommand(TOPICS.setTemperatureSet, round1(value));
  }

  publishFanModeCommand(value: number): void {
    this.publishCommand(TOPICS.fanModeSet, normalizeFanMode(value));
  }

  publishFanSpeedCommand(value: number): void {
    this.publishCommand(TOPICS.fanSpeedSet, value);
  }

  private handleMessage(topic: string, payload: Buffer): void {
    const value = toNumber(payload);

    if (value === null) {
      log(
        `ongeldige polarbear mqtt payload topic=${topic} payload=${payload.toString()}`,
      );
      return;
    }

    if (topic === TOPICS.virtualTempState) {
      this.handlers.onVirtualTemperature(roundHalf(value));
      return;
    }

    if (topic === TOPICS.setTemperatureState) {
      this.handlers.onSetTemperatureState(round1(value));
      return;
    }

    if (topic === TOPICS.fanModeState) {
      this.handlers.onFanModeState(normalizeFanMode(value));
      return;
    }

    if (topic === TOPICS.fanSpeedState) {
      this.handlers.onFanSpeedState(Math.round(value));
      return;
    }

    if (topic === TOPICS.setTemperatureSet) {
      this.handlers.onSetTemperatureCommand(round1(value));
      return;
    }

    if (topic === TOPICS.fanModeSet) {
      this.handlers.onFanModeCommand(normalizeFanMode(value));
      return;
    }

    if (topic === TOPICS.fanSpeedSet) {
      this.handlers.onFanSpeedCommand(Math.round(value));
    }
  }

  private publishCommand(topic: string, value: number): void {
    this.client?.publish(topic, String(value), {
      retain: CONFIG.mqtt.retainCommands,
    });

    log(`mqtt command publish ${topic}=${value}`);
  }
}

/* -------------------------------------------------------------------------- */
/* services/WallpanelPoller.ts */
/* -------------------------------------------------------------------------- */

class WallpanelPoller {
  private client = new ModbusClient(
    CONFIG.wallpanel.timeoutMs,
    CONFIG.wallpanel.requestGapMs,
  );

  private polarbear = new Polarbear(this.client);

  private mqttClient = new PolarbearMqttClient({
    onVirtualTemperature: (value) => this.queueVirtualTemperatureFromMqtt(value),
    onSetTemperatureCommand: (value) => this.queueSetpointCommandFromMqtt(value),
    onFanModeCommand: (value) => this.queueFanModeCommandFromMqtt(value),
    onFanSpeedCommand: (value) => this.queueFanSpeedCommandFromMqtt(value),
    onSetTemperatureState: (value) => this.rememberSetpointStateFromMqtt(value),
    onFanModeState: (value) => this.rememberFanModeStateFromMqtt(value),
    onFanSpeedState: (value) => this.rememberFanSpeedStateFromMqtt(value),
  });

  private candidates = new Map<string, Candidate>();
  private setpointCache = new Map<string, SetpointCache>();
  private suppressedWrites = new Map<string, SuppressedWrite>();
  private lastWrittenVirtualTemp = new Map<string, string>();
  private pendingMqttCommands = new Map<string, MqttWallpanelCommand>();
  private mqttCommandFlushRunning = false;

  /**
   * MQTT schrijft niet direct naar Modbus.
   * We bewaren alleen de laatste waarde.
   */
  private latestVirtualTempFromMqtt: number | null = null;
  private latestSetpointStateFromMqtt: number | null = null;
  private latestFanModeStateFromMqtt: number | null = null;
  private latestFanSpeedStateFromMqtt: number | null = null;
  private virtualTempDirty = false;
  private virtualTempFlushRunning = false;

  private running = true;
  private pollPaused = false;
  private pollCycleRunning = false;

  async start(): Promise<void> {
    await this.client.connect(CONFIG.wallpanel.host, CONFIG.wallpanel.port);

    log(
      `polarbear publisher gestart ${CONFIG.wallpanel.host}:${CONFIG.wallpanel.port} debounce=${CONFIG.wallpanel.debounceMs}ms`,
    );

    await this.clearStartupFlags();
    await this.initializeSetpointCache();

    /**
     * Pas na startup/cache subscriben op virtualTemp,
     * zodat retained MQTT de startup-cache niet vervuilt.
     */
    await this.mqttClient.connect();

    while (this.running) {
      if (this.pollPaused) {
        await sleep(CONFIG.wallpanel.pollIntervalMs);
        continue;
      }

      this.pollCycleRunning = true;

      try {
        await this.poll();
        await this.flushMqttCommands();
        await this.processCandidates();

        /**
         * VirtualTemp pas na de normale wallpanel-sync proberen te schrijven.
         */
        await this.flushVirtualTempIfWallpanelIdle();
      } finally {
        this.pollCycleRunning = false;
      }

      await sleep(CONFIG.wallpanel.pollIntervalMs);
    }
  }

  async rebootPolarbears(unitIds: number[]): Promise<void> {
    await this.polarbear.reboot(unitIds);
  }

  async setPolarbearBaudrate(
    unitIds: number[],
    baudrate: number,
  ): Promise<void> {
    await this.polarbear.setBaudrate(unitIds, baudrate);
  }

  getPolarbearLoopStatus(): { paused: boolean } {
    return {
      paused: this.pollPaused,
    };
  }

  async pausePolarbearLoop(): Promise<void> {
    if (this.pollPaused) {
      return;
    }

    this.pollPaused = true;
    await this.waitForPollIdle();
    log("polarbear poll-loop gepauzeerd, modbus verbinding blijft open");
  }

  async resumePolarbearLoop(): Promise<void> {
    if (!this.pollPaused) {
      return;
    }

    log("polarbear poll-loop hervatten: mqtt state eerst naar polarbears");
    await this.syncLatestMqttStateToPolarbears();
    await this.initializeSetpointCache();
    this.pollPaused = false;
    log("polarbear poll-loop hervat");
  }

  private async waitForPollIdle(): Promise<void> {
    while (this.pollCycleRunning) {
      await sleep(25);
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    this.mqttClient.close();
    await this.client.close();
  }

  private async poll(): Promise<void> {
    for (const unit of CONFIG.wallpanel.units) {
      let flags: number;

      try {
        flags = await this.polarbear.getFlags(unit.id);
      } catch (error) {
        log(`flags lezen mislukt unit=${unit.id}: ${formatError(error)}`);
        continue;
      }

      for (const zone of unit.zones) {
        const setpointCache = await this.updateSetpointCache(unit, zone);

        if (hasFlag(flags, zone, "setpoint")) {
          await this.consumeSetpointFlag(unit, zone, flags, setpointCache);
        }

        if (hasFlag(flags, zone, "fanMode")) {
          await this.consumeFanFlag(unit, zone, flags);
        }
      }
    }
  }

  private async initializeSetpointCache(): Promise<void> {
    for (const unit of CONFIG.wallpanel.units) {
      for (const zone of unit.zones) {
        await this.updateSetpointCache(unit, zone);
      }
    }

    log("setpoint-cache klaar");
  }

  private async updateSetpointCache(
    unit: Unit,
    zone: Zone,
  ): Promise<SetpointCache> {
    const key = sourceKey(unit.id, zone, "setpoint");
    const previous = this.setpointCache.get(key);

    try {
      const value = await this.polarbear.getPendingSetpoint(unit.id, zone);
      const signature = setpointSignature(value);

      if (!previous || previous.signature !== signature) {
        const next = {
          value,
          signature,
          changedAt: Date.now(),
        };

        this.setpointCache.set(key, next);

        log(
          `pending setpoint changed unit=${unit.id} zone=${zone} ${previous?.signature ?? "none"} -> ${signature}`,
        );

        return next;
      }

      return previous;
    } catch (error) {
      log(`pending setpoint lezen mislukt unit=${unit.id}: ${formatError(error)}`);

      return (
        previous ?? {
          value: 0,
          signature: "setpoint:0",
          changedAt: 0,
        }
      );
    }
  }

  private async consumeSetpointFlag(
    unit: Unit,
    zone: Zone,
    flags: number,
    cache: SetpointCache,
  ): Promise<void> {
    await this.safeClearFlag(unit.id, zone, "setpoint", flags);

    if (this.shouldIgnoreOwnWrite(unit.id, zone, "setpoint", cache.signature)) {
      log(`ignore own setpoint unit=${unit.id} zone=${zone} value=${cache.value}`);
      return;
    }

    const key = candidateKey(zone, "setpoint");
    const existing = this.candidates.get(key);

    if (
      existing &&
      existing.type === "setpoint" &&
      existing.sourceUnitId !== unit.id &&
      cache.changedAt < existing.changedAt
    ) {
      log(
        `stale setpoint genegeerd unit=${unit.id} zone=${zone} value=${cache.value}`,
      );
      return;
    }

    if (existing && existing.type === "setpoint") {
      log(
        `candidate overschreven zone=${zone}: unit=${existing.sourceUnitId} value=${existing.value} -> unit=${unit.id} value=${cache.value}`,
      );
    }

    this.candidates.set(key, {
      type: "setpoint",
      sourceUnitId: unit.id,
      zone,
      value: cache.value,
      signature: cache.signature,
      changedAt: cache.changedAt,
      createdAt: Date.now(),
    });

    log(`candidate setpoint unit=${unit.id} zone=${zone} value=${cache.value}`);
  }

  private async consumeFanFlag(
    unit: Unit,
    zone: Zone,
    flags: number,
  ): Promise<void> {
    try {
      const fanMode = await this.polarbear.getPendingFanMode(unit.id, zone);
      const fanSpeed = await this.polarbear.getFanSpeed(unit.id, zone);
      const signature = fanSignature(fanMode, fanSpeed);

      await this.safeClearFlag(unit.id, zone, "fanMode", flags);

      if (this.shouldIgnoreOwnWrite(unit.id, zone, "fanMode", signature)) {
        log(`ignore own fan unit=${unit.id} zone=${zone}`);
        return;
      }

      const key = candidateKey(zone, "fanMode");
      const existing = this.candidates.get(key);

      if (existing && existing.type === "fanMode") {
        log(
          `candidate fan overschreven zone=${zone}: unit=${existing.sourceUnitId} mode=${existing.fanMode} speed=${existing.fanSpeed} -> unit=${unit.id} mode=${fanMode} speed=${fanSpeed}`,
        );
      }

      this.candidates.set(key, {
        type: "fanMode",
        sourceUnitId: unit.id,
        zone,
        fanMode,
        fanSpeed,
        signature,
        changedAt: Date.now(),
        createdAt: Date.now(),
      });

      log(
        `candidate fan unit=${unit.id} zone=${zone} mode=${fanMode} speed=${fanSpeed}`,
      );
    } catch (error) {
      log(`fan verwerken mislukt unit=${unit.id}: ${formatError(error)}`);
    }
  }

  private async processCandidates(): Promise<void> {
    const now = Date.now();

    for (const [key, candidate] of Array.from(this.candidates.entries())) {
      const ageMs = now - candidate.createdAt;

      if (ageMs < CONFIG.wallpanel.debounceMs) {
        continue;
      }

      log(
        `candidate verwerken type=${candidate.type} source=${candidate.sourceUnitId} zone=${candidate.zone} ageMs=${ageMs}`,
      );

      await this.syncCandidate(candidate);
      this.candidates.delete(key);
    }
  }

  private async syncCandidate(candidate: Candidate): Promise<void> {
    for (const target of CONFIG.wallpanel.units) {
      if (target.id === candidate.sourceUnitId) continue;
      if (!target.zones.includes(candidate.zone)) continue;

      if (candidate.type === "setpoint") {
        log(
          `sync setpoint ${candidate.value} zone=${candidate.zone}: ${candidate.sourceUnitId} -> ${target.id}`,
        );

        this.suppressOwnWrite(
          target.id,
          candidate.zone,
          "setpoint",
          candidate.signature,
        );

        await this.safeWrite(() =>
          this.polarbear.setSetpoint(target.id, candidate.zone, candidate.value),
        );

        continue;
      }

      log(
        `sync fan zone=${candidate.zone}: ${candidate.sourceUnitId} -> ${target.id} mode=${candidate.fanMode} speed=${candidate.fanSpeed}`,
      );

      this.suppressOwnWrite(
        target.id,
        candidate.zone,
        "fanMode",
        candidate.signature,
      );

      await this.safeWrite(() =>
        this.polarbear.setFanMode(target.id, candidate.zone, candidate.fanMode),
      );

      await this.safeWrite(() =>
        this.polarbear.setFanSpeed(target.id, candidate.zone, candidate.fanSpeed),
      );
    }

    if (candidate.type === "setpoint") {
      log(`definitieve setTemperature naar mqtt=${candidate.value}`);
      this.mqttClient.publishSetTemperatureCommand(candidate.value);
      return;
    }

    log(
      `definitieve fan naar mqtt mode=${candidate.fanMode} speed=${candidate.fanSpeed}`,
    );

    this.mqttClient.publishFanModeCommand(candidate.fanMode);
    this.mqttClient.publishFanSpeedCommand(candidate.fanSpeed);
  }

  private queueVirtualTemperatureFromMqtt(value: number): void {
    const rounded = roundHalf(value);

    /**
     * Belangrijk:
     * MQTT handler schrijft NIET naar Modbus.
     * Hij bewaart alleen de laatste waarde.
     */
    this.latestVirtualTempFromMqtt = rounded;
    this.virtualTempDirty = true;

    log(`virtualTemp queued from mqtt value=${value} rounded=${rounded}`);
  }

  private rememberSetpointStateFromMqtt(value: number): void {
    const temperature = round1(value);
    this.latestSetpointStateFromMqtt = temperature;

    if (this.pollPaused) {
      log(`setpoint state bewaard tijdens pauze value=${temperature}`);
    }
  }

  private rememberFanModeStateFromMqtt(value: number): void {
    const fanMode = normalizeFanMode(value);
    this.latestFanModeStateFromMqtt = fanMode;

    if (this.pollPaused) {
      log(`fanMode state bewaard tijdens pauze value=${fanMode}`);
    }
  }

  private rememberFanSpeedStateFromMqtt(value: number): void {
    const fanSpeed = Math.round(value);
    this.latestFanSpeedStateFromMqtt = fanSpeed;

    if (this.pollPaused) {
      log(`fanSpeed state bewaard tijdens pauze value=${fanSpeed}`);
    }
  }

  private async syncLatestMqttStateToPolarbears(): Promise<void> {
    if (this.latestSetpointStateFromMqtt !== null) {
      this.queueSetpointCommandFromMqtt(this.latestSetpointStateFromMqtt);
    }

    if (this.latestFanModeStateFromMqtt !== null) {
      this.queueFanModeCommandFromMqtt(this.latestFanModeStateFromMqtt);
    }

    if (this.latestFanSpeedStateFromMqtt !== null) {
      this.queueFanSpeedCommandFromMqtt(this.latestFanSpeedStateFromMqtt);
    }

    await this.flushMqttCommands();
    await this.flushVirtualTempIfWallpanelIdle();
  }

  private queueSetpointCommandFromMqtt(value: number): void {
    const zone = CONFIG.airco.zone;
    const temperature = round1(value);
    const signature = setpointSignature(temperature);

    this.pendingMqttCommands.set(`mqtt:${zone}:setpoint`, {
      type: "setpoint",
      zone,
      value: temperature,
      signature,
      createdAt: Date.now(),
    });

    log(`setpoint command queued from mqtt zone=${zone} value=${temperature}`);
  }

  private queueFanModeCommandFromMqtt(value: number): void {
    const zone = CONFIG.airco.zone;
    const fanMode = normalizeFanMode(value);

    this.pendingMqttCommands.set(`mqtt:${zone}:fanMode`, {
      type: "fanMode",
      zone,
      value: fanMode,
      createdAt: Date.now(),
    });

    log(`fanMode command queued from mqtt zone=${zone} value=${fanMode}`);
  }

  private queueFanSpeedCommandFromMqtt(value: number): void {
    const zone = CONFIG.airco.zone;
    const fanSpeed = Math.round(value);

    this.pendingMqttCommands.set(`mqtt:${zone}:fanSpeed`, {
      type: "fanSpeed",
      zone,
      value: fanSpeed,
      createdAt: Date.now(),
    });

    log(`fanSpeed command queued from mqtt zone=${zone} value=${fanSpeed}`);
  }

  private async flushMqttCommands(): Promise<void> {
    if (this.mqttCommandFlushRunning || this.pendingMqttCommands.size === 0) {
      return;
    }

    this.mqttCommandFlushRunning = true;

    try {
      const commands = Array.from(this.pendingMqttCommands.values()).sort(
        (left, right) => left.createdAt - right.createdAt,
      );

      this.pendingMqttCommands.clear();

      for (const command of commands) {
        await this.applyMqttCommandToPolarbears(command);
      }
    } finally {
      this.mqttCommandFlushRunning = false;
    }
  }

  private async applyMqttCommandToPolarbears(
    command: MqttWallpanelCommand,
  ): Promise<void> {
    if (!this.mqttCommandWinsOverPendingPanelChange(command)) {
      return;
    }

    if (command.type === "setpoint") {
      await this.applyMqttSetpointToPolarbears(command);
      return;
    }

    if (command.type === "fanMode") {
      await this.applyMqttFanModeToPolarbears(command);
      return;
    }

    await this.applyMqttFanSpeedToPolarbears(command);
  }

  private mqttCommandWinsOverPendingPanelChange(
    command: MqttWallpanelCommand,
  ): boolean {
    const key =
      command.type === "setpoint"
        ? candidateKey(command.zone, "setpoint")
        : candidateKey(command.zone, "fanMode");
    const pendingPanelChange = this.candidates.get(key);

    if (!pendingPanelChange) {
      return true;
    }

    if (pendingPanelChange.changedAt > command.createdAt) {
      log(
        `mqtt command overgeslagen omdat panel nieuwer is type=${command.type} zone=${command.zone}`,
      );
      return false;
    }

    this.candidates.delete(key);

    log(
      `mqtt command wint van oudere panel candidate type=${command.type} zone=${command.zone}`,
    );

    return true;
  }

  private async applyMqttSetpointToPolarbears(
    command: Extract<MqttWallpanelCommand, { type: "setpoint" }>,
  ): Promise<void> {
    log(`mqtt setpoint naar polarbears zone=${command.zone} value=${command.value}`);

    for (const unit of CONFIG.wallpanel.units) {
      if (!unit.zones.includes(command.zone)) {
        continue;
      }

      this.suppressOwnWrite(
        unit.id,
        command.zone,
        "setpoint",
        command.signature,
      );

      this.setpointCache.set(sourceKey(unit.id, command.zone, "setpoint"), {
        value: command.value,
        signature: command.signature,
        changedAt: Date.now(),
      });

      await this.safeWrite(() =>
        this.polarbear.setSetpoint(unit.id, command.zone, command.value),
      );
    }
  }

  private async applyMqttFanModeToPolarbears(
    command: Extract<MqttWallpanelCommand, { type: "fanMode" }>,
  ): Promise<void> {
    log(`mqtt fanMode naar polarbears zone=${command.zone} value=${command.value}`);

    for (const unit of CONFIG.wallpanel.units) {
      if (!unit.zones.includes(command.zone)) {
        continue;
      }

      const fanSpeed = await this.readFanSpeedForSignature(unit.id, command.zone);

      this.suppressOwnWrite(
        unit.id,
        command.zone,
        "fanMode",
        fanSignature(command.value, fanSpeed),
      );

      await this.safeWrite(() =>
        this.polarbear.setFanMode(unit.id, command.zone, command.value),
      );
    }
  }

  private async applyMqttFanSpeedToPolarbears(
    command: Extract<MqttWallpanelCommand, { type: "fanSpeed" }>,
  ): Promise<void> {
    log(`mqtt fanSpeed naar polarbears zone=${command.zone} value=${command.value}`);

    for (const unit of CONFIG.wallpanel.units) {
      if (!unit.zones.includes(command.zone)) {
        continue;
      }

      const fanMode = await this.readFanModeForSignature(unit.id, command.zone);

      this.suppressOwnWrite(
        unit.id,
        command.zone,
        "fanMode",
        fanSignature(fanMode, command.value),
      );

      await this.safeWrite(() =>
        this.polarbear.setFanSpeed(unit.id, command.zone, command.value),
      );
    }
  }

  private async readFanSpeedForSignature(unitId: number, zone: Zone): Promise<number> {
    try {
      return await this.polarbear.getFanSpeed(unitId, zone);
    } catch (error) {
      log(`fanSpeed lezen voor mqtt suppress mislukt unit=${unitId}: ${formatError(error)}`);
      return 0;
    }
  }

  private async readFanModeForSignature(unitId: number, zone: Zone): Promise<number> {
    try {
      return await this.polarbear.getPendingFanMode(unitId, zone);
    } catch (error) {
      log(`fanMode lezen voor mqtt suppress mislukt unit=${unitId}: ${formatError(error)}`);
      return 1;
    }
  }

  private async flushVirtualTempIfWallpanelIdle(): Promise<void> {
    if (!this.virtualTempDirty) {
      return;
    }

    if (this.latestVirtualTempFromMqtt === null) {
      return;
    }

    if (this.virtualTempFlushRunning) {
      return;
    }

    /**
     * Als er nog een normale setpoint/fan candidate actief is,
     * absoluut geen virtualTemp schrijven.
     */
    if (this.candidates.size > 0) {
      log("virtualTemp uitgesteld omdat wallpanel-sync nog candidate actief heeft");
      return;
    }

    this.virtualTempFlushRunning = true;

    try {
      const valueToWrite = this.latestVirtualTempFromMqtt;

      /**
       * Deze waarde wordt nu verwerkt.
       * Als tijdens het schrijven nieuwe MQTT binnenkomt,
       * zet queueVirtualTemperatureFromMqtt virtualTempDirty weer op true.
       */
      this.virtualTempDirty = false;

      await this.writeVirtualTemperatureAfterWallpanelSync(valueToWrite);
    } finally {
      this.virtualTempFlushRunning = false;
    }
  }

  private async writeVirtualTemperatureAfterWallpanelSync(
    value: number,
  ): Promise<void> {
    const rounded = roundHalf(value);
    const signature = virtualTempSignature(rounded);

    log(`virtualTemp schrijven na wallpanel-sync rounded=${rounded}`);

    for (
      let index = 0;
      index < CONFIG.wallpanel.virtualTemperatureTargets.length;
      index++
    ) {
      const target = CONFIG.wallpanel.virtualTemperatureTargets[index];
      const key = virtualTempTargetKey(target);

      if (this.lastWrittenVirtualTemp.get(key) === signature) {
        continue;
      }

      try {
        /**
         * VirtualTemp kan setpoint flags/pending changes veroorzaken.
         * Daarom onderdrukken we de mogelijke eigen write.
         */
        this.suppressOwnWrite(
          target.unitId,
          target.zone,
          "setpoint",
          setpointSignature(rounded),
        );

        await this.polarbear.setVirtualTemperature(target, rounded);
        this.lastWrittenVirtualTemp.set(key, signature);
      } catch (error) {
        log(
          `virtualTemp write error ${target.name} unit=${target.unitId} zone=${target.zone} register=${target.register}: ${formatError(error)}`,
        );
      }

      if (index < CONFIG.wallpanel.virtualTemperatureTargets.length - 1) {
        await sleep(CONFIG.wallpanel.virtualTempWriteGapMs);
      }
    }
  }

  private async clearStartupFlags(): Promise<void> {
    for (const unit of CONFIG.wallpanel.units) {
      let flags: number;

      try {
        flags = await this.polarbear.getFlags(unit.id);
      } catch {
        continue;
      }

      for (const zone of unit.zones) {
        if (hasFlag(flags, zone, "setpoint")) {
          flags = await this.safeClearFlag(unit.id, zone, "setpoint", flags);
        }

        if (hasFlag(flags, zone, "fanMode")) {
          flags = await this.safeClearFlag(unit.id, zone, "fanMode", flags);
        }
      }
    }

    log("startup flags gewist");
  }

  private async safeClearFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    flags?: number,
  ): Promise<number> {
    try {
      return await this.polarbear.clearFlag(unitId, zone, type, flags);
    } catch (error) {
      if (!isTimeoutError(error)) {
        log(
          `flag clear error unit=${unitId} zone=${zone} type=${type}: ${formatError(error)}`,
        );
      }

      return flags ?? 0;
    }
  }

  private async safeWrite(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      if (isTimeoutError(error)) {
        log("write timeout, mogelijk wel aangekomen");
        return;
      }

      log(`write error: ${formatError(error)}`);
    }
  }

  private suppressOwnWrite(
    unitId: number,
    zone: Zone,
    type: FlagType,
    signature: string,
  ): void {
    this.suppressedWrites.set(sourceKey(unitId, zone, type), {
      signature,
      until: Date.now() + CONFIG.wallpanel.suppressOwnWriteMs,
    });
  }

  private shouldIgnoreOwnWrite(
    unitId: number,
    zone: Zone,
    type: FlagType,
    signature: string,
  ): boolean {
    const key = sourceKey(unitId, zone, type);
    const suppressed = this.suppressedWrites.get(key);

    if (!suppressed) return false;

    if (Date.now() > suppressed.until) {
      this.suppressedWrites.delete(key);
      return false;
    }

    if (suppressed.signature !== signature) {
      return false;
    }

    this.suppressedWrites.delete(key);
    return true;
  }
}

/* -------------------------------------------------------------------------- */
/* app.ts */
/* -------------------------------------------------------------------------- */

let configStore: ConfigStore | null = null;
let wallpanelPoller: WallpanelPoller | null = null;
let aircoBridge: AircoMqttBridge | null = null;
let controlServer: ControlHttpServer | null = null;

const start = async (): Promise<void> => {
  const tasks: Promise<void>[] = [];

  configStore = new ConfigStore();
  await configStore.connect();
  await configStore.loadAndApply();

  wallpanelPoller =
    CONFIG.runMode === "both" || CONFIG.runMode === "polarbearPublisher"
      ? new WallpanelPoller()
      : null;

  aircoBridge =
    CONFIG.runMode === "both" || CONFIG.runMode === "aircoBridge"
      ? new AircoMqttBridge()
      : null;

  controlServer = CONFIG.control.enabled
    ? new ControlHttpServer(configStore, wallpanelPoller ?? undefined)
    : null;

  if (controlServer) {
    await controlServer.start();
  }

  if (aircoBridge) {
    await aircoBridge.start();
  }

  if (wallpanelPoller) {
    tasks.push(wallpanelPoller.start());
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
};

const stop = async (): Promise<void> => {
  log("shutdown gestart");

  if (wallpanelPoller) {
    await wallpanelPoller.stop();
  }

  if (aircoBridge) {
    await aircoBridge.stop();
  }

  if (controlServer) {
    await controlServer.stop();
  }

  if (configStore) {
    await configStore.close();
  }
};

async function startWithShutdownHandlers(): Promise<void> {
  process.once("SIGINT", async () => {
    await stop();
    process.exit(0);
  });

  process.once("SIGTERM", async () => {
    await stop();
    process.exit(0);
  });

  await start();
}

async function startOrExit(): Promise<void> {
  try {
    await startWithShutdownHandlers();
  } catch (error) {
    log(`fatal: ${formatError(error)}`);
    await stop();
    process.exit(1);
  }
}

void startOrExit();
