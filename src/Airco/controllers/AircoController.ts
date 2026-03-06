import AdapterRegistry from '../adapters/AdapterRegistry';
import { AircoAdapter, AircoZone } from '../adapters/IAircoAdapter';
import {
  AircopanelRepository,
  Device,
} from '../repositories/WallpanelRepository';

type DeviceWithMeta = Device & { zoneId?: string; roomId?: string };

export default class AircoController {
  private repository: AircopanelRepository;

  constructor(
    private registry: AdapterRegistry,
    mongoUri: string,
  ) {
    this.repository = new AircopanelRepository(mongoUri);
  }

  // --------------------
  // Device CRUD
  // --------------------

  async getDevices() {
    return await this.repository.getDevices();
  }

  async addDevice(device: any) {
    return await this.repository.addDevice(device);
  }

  async getDeviceById(deviceId: string) {
    return await this.repository.getDeviceById(deviceId);
  }

  async deleteDevice(deviceId: string) {
    return await this.repository.deleteDevice(deviceId);
  }

  async updateDevice(device: any) {
    return await this.repository.updateDevice(device);
  }

  // --------------------
  // Adapter helpers
  // --------------------

  private requireConnection(device: DeviceWithMeta) {
    if (!device.ip || !device.port) {
      throw new Error('Device missing ip/port');
    }
    if (!device.type) {
      throw new Error('Device missing type');
    }
    return {
      host: device.ip,
      port: device.port,
    };
  }

  private async withAdapter<T>(
    deviceId: string,
    fn: (adapter: AircoAdapter, device: DeviceWithMeta) => Promise<T>,
  ): Promise<T> {
    const device = await this.repository.getDeviceById(deviceId);
    if (!device) throw new Error('Device not found');

    const connection = this.requireConnection(device);
    const adapter = this.registry.create(device.type, connection);

    await adapter.connect();
    try {
      return await fn(adapter, device);
    } finally {
      await adapter.disconnect();
    }
  }

  // --------------------
  // Airco operations
  // --------------------

  async getSetpoint(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
  ): Promise<number> {
    return this.withAdapter(deviceId, (adapter) =>
      adapter.getSetpoint(unitId, zone),
    );
  }

  async setSetpoint(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
    temperature: number,
  ): Promise<void> {
    await this.withAdapter(deviceId, (adapter) =>
      adapter.setSetpoint(unitId, zone, temperature),
    );
  }

  async getVirtualTemperature(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
  ): Promise<number> {
    return this.withAdapter(deviceId, (adapter) =>
      adapter.getVirtualTemperature(unitId, zone),
    );
  }

  async setVirtualTemperature(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
    temperature: number,
  ): Promise<void> {
    await this.withAdapter(deviceId, (adapter) =>
      adapter.setVirtualTemperature(unitId, zone, temperature),
    );
  }

  async getFanSpeed(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
  ): Promise<number> {
    return this.withAdapter(deviceId, (adapter) =>
      adapter.getFanSpeed(unitId, zone),
    );
  }

  async setFanSpeed(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
    speed: number,
  ): Promise<void> {
    await this.withAdapter(deviceId, (adapter) =>
      adapter.setFanSpeed(unitId, zone, speed),
    );
  }

  async getFanMode(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
  ): Promise<number> {
    return this.withAdapter(deviceId, (adapter) =>
      adapter.getFanMode(unitId, zone),
    );
  }

  async setFanMode(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
    mode: number,
  ): Promise<void> {
    await this.withAdapter(deviceId, (adapter) =>
      adapter.setFanMode(unitId, zone, mode),
    );
  }
}
