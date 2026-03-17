import { MongoClient, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

export type PanelDevice = {
  id: string;
  name?: string;
  ip: string;
  type: string;
  model?: string;
  port: number;
  ids: number[];
};

export type AirconditionerData = {
  deviceId: string;
  type: string;
  deviceTerminalId: string;
};

export type AirconditionerDevice = {
  id: string;
  name?: string;
  minTemperature?: number;
  maxTemperature?: number;
  minSetTemperature?: number;
  maxSetTemperature?: number;
  setTemperature?: number;
  currentTemperature?: number;
  currentFanspeed?: number;
  minFanspeed?: number;
  maxFanspeed?: number;
  data: AirconditionerData;
  deviceType?: string;
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

export class AircopanelRepository {
  private client: MongoClient;
  private readonly dbName = 'lavie';
  private readonly collectionName = 'enviromentZones';

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

  async getZones(): Promise<ZoneDocument[]> {
    const collection = await this.getCollection();
    return collection.find({}).toArray();
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
        return device;
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
        return device;
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
            ...device,
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
            ...device,
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
    deviceFields.id = deviceFields.id || uuidv4();

    await collection.updateOne(
      { _id: new ObjectId(zoneId), 'rooms.id': roomId },
      { $push: { 'rooms.$.aircopanels': deviceFields } },
    );

    return deviceFields;
  }

  async addAircoDevice(
    device: AirconditionerDevice & { zoneId: string; roomId: string },
  ): Promise<AirconditionerDevice> {
    const collection = await this.getCollection();

    const { zoneId, roomId, ...deviceFields } = device;
    deviceFields.id = deviceFields.id || uuidv4();

    await collection.updateOne(
      { _id: new ObjectId(zoneId), 'rooms.id': roomId },
      { $push: { 'rooms.$.airconditioners': deviceFields } },
    );

    return deviceFields;
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

        await collection.updateOne(
          { _id: zone._id },
          { $set: { [updatePath]: device } },
        );

        return device;
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
      const deviceIdx = (room.airconditioners || []).findIndex(
        (d) => d.id === device.id,
      );

      if (deviceIdx !== -1) {
        const updatePath = `rooms.${roomIdx}.airconditioners.${deviceIdx}`;

        await collection.updateOne(
          { _id: zone._id },
          { $set: { [updatePath]: device } },
        );

        return device;
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
