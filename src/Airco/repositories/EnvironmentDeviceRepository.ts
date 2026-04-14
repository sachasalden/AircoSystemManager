import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

export type EnvironmentDevice = {
  id: string;
  name: string;
  type: string;
  ip: string;
  port: string;
  bidirectional: boolean;
};

export class EnvironmentDeviceRepository {
  private client: MongoClient;
  private readonly dbName = 'lavie';
  private readonly collectionName = 'enviromentDevices';

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
      .collection<EnvironmentDevice>(this.collectionName);
  }

  private normalize(device: Partial<EnvironmentDevice>): EnvironmentDevice {
    return {
      id: device.id || uuidv4(),
      name: device.name || 'New',
      type: device.type || 'HeinAndHopmanIpSystem',
      ip: device.ip || '',
      port: String(device.port ?? ''),
      bidirectional: Boolean(device.bidirectional),
    };
  }

  async getDevices(): Promise<EnvironmentDevice[]> {
    const collection = await this.getCollection();
    const devices = await collection.find({}).toArray();
    return devices.map((device) => this.normalize(device));
  }

  async getDeviceById(id: string): Promise<EnvironmentDevice | null> {
    const collection = await this.getCollection();
    const device = await collection.findOne({ id });

    return device ? this.normalize(device) : null;
  }

  async addDevice(
    device: Partial<EnvironmentDevice>,
  ): Promise<EnvironmentDevice> {
    const collection = await this.getCollection();
    const newDevice = this.normalize(device);

    await collection.insertOne(newDevice);

    return newDevice;
  }

  async updateDevice(
    id: string,
    device: Partial<EnvironmentDevice>,
  ): Promise<EnvironmentDevice | null> {
    const collection = await this.getCollection();

    const existingDevice = await this.getDeviceById(id);

    if (!existingDevice) {
      return null;
    }

    const updatedDevice = this.normalize({
      ...existingDevice,
      ...device,
      id,
    });

    await collection.updateOne({ id }, { $set: updatedDevice });

    return updatedDevice;
  }

  async deleteDevice(id: string): Promise<string | null> {
    const collection = await this.getCollection();

    const result = await collection.deleteOne({ id });

    if (result.deletedCount === 0) {
      return null;
    }

    return id;
  }
}
