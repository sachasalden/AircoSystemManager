import { MongoClient, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

export type PanelDevice = {
  id: string;
  name?: string;
  ip: string;
  type: string;
  model?: string;
  version?: string;
  port: number;
  ids: number[];
  terminalIds?: number[];
  modbusUnits?: Array<{
    id: number;
    name?: string;
    type?: string;
    zones?: number[];
  }>;
};

export type Device = PanelDevice;

export type AirconditionerData = {
  deviceId: string;
  type: string;
  deviceTerminalId: string;
  roomTemparatureAddress?: string | number;
  roomTemparatureSetPointAddress?: string | number;
  fanspeedAddress?: string | number;
  fanspeedSetPointAddress?: string | number;
  [key: string]: any;
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
  data: AirconditionerData;
};

type Room = {
  id: string;
  name?: string;
  aircopanels?: PanelDevice[];
  airconditioners?: AirconditionerDevice[];
};

type ZoneDocument = {
  _id: ObjectId;
  name: string;
  rooms: Room[];
};

const DEFAULT_PANEL_TYPE = 'moxa';
const DEFAULT_UNIT_TYPE = 'polarbear-v1';
const DEFAULT_PANEL_PORT = 4001;

const DEFAULT_AIRCO_DEVICE_TYPE = 'FC-500PC/FC-1100PC';
const DEFAULT_AIRCO_ADAPTER_TYPE = 'HeinAndHopmanIpSystem';
const DEFAULT_AIRCO_CURRENT_TEMPERATURE = -1;
const DEFAULT_AIRCO_CURRENT_FANSPEED = -1;

type AircoDefaults = {
  minTemperature: number;
  maxTemperature: number;
  setTemperature: number;
  minFanspeed: number;
  maxFanspeed: number;
  minFanMode: number;
  maxFanMode: number;
};

const GENERIC_AIRCO_DEFAULTS: AircoDefaults = {
  minTemperature: 16,
  maxTemperature: 30,
  setTemperature: 16,
  minFanspeed: 0,
  maxFanspeed: 4,
  minFanMode: 0,
  maxFanMode: 1,
};

const FC500_PC_AIRCO_DEFAULTS: AircoDefaults = {
  minTemperature: 9,
  maxTemperature: 29,
  setTemperature: 9,
  minFanspeed: 1,
  maxFanspeed: 6,
  minFanMode: 0,
  maxFanMode: 1,
};

export class AircopanelRepository {
  private client: MongoClient;
  private readonly dbName = process.env.MONGO_DB || 'wallpanel_sync';
  private readonly collectionName =
    process.env.MONGO_CLIMATEZONES_COLLECTION || 'Climatezones';

  constructor(mongoUri: string) {
    this.client = new MongoClient(mongoUri);
  }

  async connect() {
    if (!(this.client as any).topology?.isConnected?.()) {
      await this.client.connect();
    }
  }

  private async getCollection() {
    await this.connect();
    return this.client
      .db(this.dbName)
      .collection<ZoneDocument>(this.collectionName);
  }

  private toNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private getAircoDefaults(deviceType?: string): AircoDefaults {
    const normalizedType = String(deviceType ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');

    if (
      normalizedType === 'fc-500pc/fc-1100pc' ||
      normalizedType === 'fc500-pc' ||
      normalizedType === 'dc500-pc'
    ) {
      return FC500_PC_AIRCO_DEFAULTS;
    }

    return GENERIC_AIRCO_DEFAULTS;
  }

  private normalizePanelDevice(device: Partial<PanelDevice>): PanelDevice {
    const legacyUnitType =
      device.version && device.version.startsWith('polarbear-')
        ? device.version
        : device.type && device.type.startsWith('polarbear-')
          ? device.type
          : DEFAULT_UNIT_TYPE;

    const modbusUnits = Array.isArray(device.modbusUnits)
      ? device.modbusUnits
          .map((unit) => ({
            id: this.toNumber(unit.id, NaN),
            name: unit.name ?? `Unit ${unit.id}`,
            type: unit.type ?? legacyUnitType,
            zones: Array.isArray(unit.zones) ? unit.zones.map(Number) : [1],
          }))
          .filter((unit) => Number.isFinite(unit.id))
      : Array.isArray(device.ids)
        ? device.ids
            .map((id) => this.toNumber(id, NaN))
            .filter((id) => Number.isFinite(id))
            .map((id) => ({
              id,
              name: `Unit ${id}`,
              type: legacyUnitType,
              zones: [1],
            }))
        : Array.isArray(device.terminalIds)
          ? device.terminalIds
              .map((id) => this.toNumber(id, NaN))
              .filter((id) => Number.isFinite(id))
              .map((id) => ({
                id,
                name: `Unit ${id}`,
                type: legacyUnitType,
                zones: [1],
              }))
        : [];

    return {
      id: device.id || uuidv4(),
      name: device.name ?? '',
      ip: device.ip ?? '',
      type: device.type?.startsWith('polarbear-')
        ? DEFAULT_PANEL_TYPE
        : device.type ?? DEFAULT_PANEL_TYPE,
      model: device.model ?? '',
      port: this.toNumber(device.port, DEFAULT_PANEL_PORT),
      ids: modbusUnits.map((unit) => unit.id),
      terminalIds: modbusUnits.map((unit) => unit.id),
      modbusUnits,
    };
  }

  private normalizeAirconditionerDevice(
    device: Partial<AirconditionerDevice>,
  ): AirconditionerDevice {
    const deviceType = device.deviceType ?? DEFAULT_AIRCO_DEVICE_TYPE;
    const defaults = this.getAircoDefaults(deviceType);
    const minTemperature = this.toNumber(
      device.minTemperature,
      defaults.minTemperature,
    );
    const maxTemperature = this.toNumber(
      device.maxTemperature,
      defaults.maxTemperature,
    );

    const minSetTemperature = this.toNumber(
      device.minSetTemperature,
      minTemperature,
    );
    const maxSetTemperature = this.toNumber(
      device.maxSetTemperature,
      maxTemperature,
    );

    const minFanspeed = this.toNumber(device.minFanspeed, defaults.minFanspeed);
    const maxFanspeed = this.toNumber(device.maxFanspeed, defaults.maxFanspeed);
    const minFanMode = this.toNumber(device.minFanMode, defaults.minFanMode);
    const maxFanMode = this.toNumber(device.maxFanMode, defaults.maxFanMode);

    let setTemperature = this.toNumber(
      device.setTemperature,
      defaults.setTemperature,
    );

    if (setTemperature < minSetTemperature) {
      setTemperature = minSetTemperature;
    }

    if (setTemperature > maxSetTemperature) {
      setTemperature = maxSetTemperature;
    }

    return {
      id: device.id || uuidv4(),
      name: device.name ?? '',
      deviceType,
      minTemperature,
      maxTemperature,
      minSetTemperature,
      maxSetTemperature,
      setTemperature,
      currentTemperature: this.toNumber(
        device.currentTemperature,
        DEFAULT_AIRCO_CURRENT_TEMPERATURE,
      ),
      currentFanspeed: this.toNumber(
        device.currentFanspeed,
        DEFAULT_AIRCO_CURRENT_FANSPEED,
      ),
      minFanspeed,
      maxFanspeed,
      minFanMode,
      maxFanMode,
      data: {
        ...(device.data ?? {}),
        deviceId: device.data?.deviceId || uuidv4(),
        type: device.data?.type ?? DEFAULT_AIRCO_ADAPTER_TYPE,
        deviceTerminalId: String(device.data?.deviceTerminalId ?? '1'),
      },
    };
  }

  private normalizeRoom(room: Partial<Room>): Room {
    return {
      id: room.id || uuidv4(),
      name: room.name ?? '',
      aircopanels: Array.isArray(room.aircopanels)
        ? room.aircopanels.map((panel) => this.normalizePanelDevice(panel))
        : [],
      airconditioners: Array.isArray(room.airconditioners)
        ? room.airconditioners.map((airco) =>
            this.normalizeAirconditionerDevice(airco),
          )
        : [],
    };
  }

  private normalizeZone(zone: ZoneDocument): ZoneDocument {
    return {
      ...zone,
      rooms: Array.isArray(zone.rooms)
        ? zone.rooms.map((room) => this.normalizeRoom(room))
        : [],
    };
  }

  async getZones(): Promise<ZoneDocument[]> {
    const collection = await this.getCollection();
    const zones = await collection.find({}).toArray();
    return zones.map((zone) => this.normalizeZone(zone));
  }

  async getDeviceById(deviceId: string): Promise<PanelDevice | null> {
    const collection = await this.getCollection();

    const zone = await collection.findOne({
      'rooms.aircopanels.id': deviceId,
    });

    if (!zone) {
      return null;
    }

    for (const room of zone.rooms || []) {
      const device = room.aircopanels?.find((d) => d.id === deviceId);
      if (device) {
        return this.normalizePanelDevice(device);
      }
    }

    return null;
  }

  async getAircoDeviceById(
    deviceId: string,
  ): Promise<AirconditionerDevice | null> {
    const collection = await this.getCollection();

    const zone = await collection.findOne({
      'rooms.airconditioners.id': deviceId,
    });

    if (!zone) {
      return null;
    }

    for (const room of zone.rooms || []) {
      const device = room.airconditioners?.find((d) => d.id === deviceId);
      if (device) {
        return this.normalizeAirconditionerDevice(device);
      }
    }

    return null;
  }

  async getDevices(): Promise<
    (PanelDevice & { zoneId: string; roomId: string })[]
  > {
    const zones = await this.getZones();
    const devices: (PanelDevice & { zoneId: string; roomId: string })[] = [];

    for (const zone of zones) {
      for (const room of zone.rooms || []) {
        for (const device of room.aircopanels || []) {
          devices.push({
            ...this.normalizePanelDevice(device),
            zoneId: zone._id.toString(),
            roomId: room.id,
          });
        }
      }
    }

    return devices;
  }

  async getAircoDevices(): Promise<
    (AirconditionerDevice & { zoneId: string; roomId: string })[]
  > {
    const zones = await this.getZones();
    const devices: (AirconditionerDevice & {
      zoneId: string;
      roomId: string;
    })[] = [];

    for (const zone of zones) {
      for (const room of zone.rooms || []) {
        for (const device of room.airconditioners || []) {
          devices.push({
            ...this.normalizeAirconditionerDevice(device),
            zoneId: zone._id.toString(),
            roomId: room.id,
          });
        }
      }
    }

    return devices;
  }

  async addDevice(
    device: PanelDevice & { zoneId: string; roomId: string },
  ): Promise<PanelDevice> {
    const collection = await this.getCollection();

    const { zoneId, roomId, ...deviceFields } = device;
    const normalizedDevice = this.normalizePanelDevice(deviceFields);

    await collection.updateOne(
      { _id: new ObjectId(zoneId), 'rooms.id': roomId },
      { $push: { 'rooms.$.aircopanels': normalizedDevice } },
    );

    return normalizedDevice;
  }

  async addAircoDevice(
    device: AirconditionerDevice & { zoneId: string; roomId: string },
  ): Promise<AirconditionerDevice> {
    const collection = await this.getCollection();

    const { zoneId, roomId, ...deviceFields } = device;
    const normalizedDevice = this.normalizeAirconditionerDevice(deviceFields);

    await collection.updateOne(
      { _id: new ObjectId(zoneId), 'rooms.id': roomId },
      { $push: { 'rooms.$.airconditioners': normalizedDevice } },
    );

    return normalizedDevice;
  }

  async updateDevice(device: PanelDevice): Promise<PanelDevice | null> {
    const collection = await this.getCollection();

    const zone = await collection.findOne({
      'rooms.aircopanels.id': device.id,
    });

    if (!zone) {
      return null;
    }

    for (const [roomIdx, room] of zone.rooms.entries()) {
      const deviceIdx = (room.aircopanels || []).findIndex(
        (d) => d.id === device.id,
      );

      if (deviceIdx !== -1) {
        const updatePath = `rooms.${roomIdx}.aircopanels.${deviceIdx}`;
        const normalizedDevice = this.normalizePanelDevice(device);

        await collection.updateOne(
          { _id: zone._id },
          { $set: { [updatePath]: normalizedDevice } },
        );

        return normalizedDevice;
      }
    }

    return null;
  }

  async updateAircoDevice(
    device: AirconditionerDevice,
  ): Promise<AirconditionerDevice | null> {
    const collection = await this.getCollection();

    const zone = await collection.findOne({
      'rooms.airconditioners.id': device.id,
    });

    if (!zone) {
      return null;
    }

    for (const [roomIdx, room] of zone.rooms.entries()) {
      const existingDevice = (room.airconditioners || []).find(
        (d) => d.id === device.id,
      );

      const deviceIdx = (room.airconditioners || []).findIndex(
        (d) => d.id === device.id,
      );

      if (deviceIdx !== -1 && existingDevice) {
        const updatePath = `rooms.${roomIdx}.airconditioners.${deviceIdx}`;

        const normalizedDevice = this.normalizeAirconditionerDevice({
          ...existingDevice,
          ...device,
          data: {
            ...(existingDevice.data || {}),
            ...(device.data || {}),
            deviceId:
              device.data?.deviceId ||
              existingDevice.data?.deviceId ||
              uuidv4(),
          },
        });

        await collection.updateOne(
          { _id: zone._id },
          { $set: { [updatePath]: normalizedDevice } },
        );

        return normalizedDevice;
      }
    }

    return null;
  }

  async deleteDevice(deviceId: string): Promise<string> {
    const collection = await this.getCollection();

    await collection.updateMany(
      {},
      { $pull: { 'rooms.$[].aircopanels': { id: deviceId } } },
    );

    return deviceId;
  }

  async deleteAircoDevice(deviceId: string): Promise<string> {
    const collection = await this.getCollection();

    await collection.updateMany(
      {},
      { $pull: { 'rooms.$[].airconditioners': { id: deviceId } } },
    );

    return deviceId;
  }
}
