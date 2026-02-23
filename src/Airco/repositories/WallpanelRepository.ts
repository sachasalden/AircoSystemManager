// src/Airco/repositories/WallpanelRepository.ts
import { MongoClient, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

export type Device = {
  id: string;
  ip: string;
  type: string;
  port: number;
  ids: number[];
};

export class AircopanelRepository {
  private client: MongoClient;
  private dbName = 'lavie';
  private collectionName = 'enviromentZones';

  constructor(mongoUri: string) {
    this.client = new MongoClient(mongoUri);
  }

  async connect() {
    if (!this.client.topology?.isConnected()) {
      await this.client.connect();
    }
  }

  // Find a device by id
  async getDeviceById(deviceId: string): Promise<Device | null> {
    await this.connect();
    const db = this.client.db(this.dbName);
    const collection = db.collection(this.collectionName);

    const zone = await collection.findOne({
      'rooms.aircopanels.id': deviceId,
    });

    if (!zone) return null;

    for (const room of zone.rooms) {
      const device = room.aircopanels.find((d: Device) => d.id === deviceId);
      if (device) return device;
    }
    return null;
  }

  // Get all devices
  async getDevices(): Promise<(Device & { zoneId: string; roomId: string })[]> {
    await this.connect();
    const db = this.client.db(this.dbName);
    const collection = db.collection(this.collectionName);

    const zones = await collection.find({}).toArray();
    const devices: (Device & { zoneId: string; roomId: string })[] = [];
    for (const zone of zones) {
      for (const room of zone.rooms) {
        if (room.aircopanels) {
          for (const device of room.aircopanels) {
            devices.push({
              ...device,
              zoneId: zone._id.toString(),
              roomId: room.id,
            });
          }
        }
      }
    }
    return devices;
  }

  async addDevice(device: Device & { zoneId: string; roomId: string },): Promise<Device> {
    await this.connect();
    const db = this.client.db(this.dbName);
    const collection = db.collection(this.collectionName);

    const { zoneId, roomId, ...deviceFields } = device;
    deviceFields.id = deviceFields.id || uuidv4();

    await collection.updateOne(
      { _id: new ObjectId(zoneId), 'rooms.id': roomId },
      { $push: { 'rooms.$.aircopanels': deviceFields } },
    );
    return deviceFields;
  }

  // Update a device by id
  async updateDevice(device: Device): Promise<Device | null> {
    await this.connect();
    const db = this.client.db(this.dbName);
    const collection = db.collection(this.collectionName);

    // Find the zone and room containing the device
    const zone = await collection.findOne({
      'rooms.aircopanels.id': device.id,
    });

    if (!zone) return null;

    for (const [roomIdx, room] of zone.rooms.entries()) {
      const deviceIdx = room.aircopanels.findIndex(
        (d: Device) => d.id === device.id,
      );
      if (deviceIdx !== -1) {
        // Update the device in the array
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

  // Delete a device by id
  async deleteDevice(deviceId: string): Promise<string> {
    await this.connect();
    const db = this.client.db(this.dbName);
    const collection = db.collection(this.collectionName);

    await collection.updateMany(
      {},
      { $pull: { 'rooms.$[].aircopanels': { id: deviceId } } },
    );
    return deviceId;
  }
}
