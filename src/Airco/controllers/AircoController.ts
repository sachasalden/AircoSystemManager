import AdapterRegistry from '../adapters/AdapterRegistry';
import {
  AircoAdapter,
  AircoConnection,
  AircoZone,
} from '../adapters/IAircoAdapter';
import {
  AircopanelRepository,
  AirconditionerDevice,
} from '../repositories/WallpanelRepository';

type AircoDeviceWithMeta = AirconditionerDevice & {
  zoneId?: string;
  roomId?: string;
};

export default class AircoController {
  private repository: AircopanelRepository;

  // Tijdelijk hardcoded, omdat airconditioners in jouw DB geen ip/port op device-niveau hebben.
  private readonly AIRCO_HOST = '192.168.55.10';
  private readonly AIRCO_PORT = 502;

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
    return await this.repository.getAircoDevices();
  }

  async addDevice(
    device: AircoDeviceWithMeta & { zoneId: string; roomId: string },
  ) {
    return await this.repository.addAircoDevice(device);
  }

  async getDeviceById(deviceId: string) {
    return await this.repository.getAircoDeviceById(deviceId);
  }

  async deleteDevice(deviceId: string) {
    return await this.repository.deleteAircoDevice(deviceId);
  }

  async updateDevice(device: AircoDeviceWithMeta) {
    return await this.repository.updateAircoDevice(device);
  }

  // --------------------
  // Adapter helpers
  // --------------------

  private requireConnection(device: AircoDeviceWithMeta): AircoConnection {
    const type = device.data?.type;
    const model = device.deviceType;

    if (!type) {
      throw new Error('Airco device missing data.type');
    }

    return {
      host: this.AIRCO_HOST,
      port: this.AIRCO_PORT,
      type,
      model,
    };
  }

  private resolveUnitId(
    device: AircoDeviceWithMeta,
    requestedUnitId?: number,
  ): number {
    if (Number.isFinite(requestedUnitId)) {
      return Number(requestedUnitId);
    }

    const dbUnitId = Number(device.data?.deviceTerminalId);

    if (!Number.isFinite(dbUnitId)) {
      throw new Error('Airco device missing valid data.deviceTerminalId');
    }

    return dbUnitId;
  }

  private async withAdapter<T>(
    deviceId: string,
    fn: (
      adapter: AircoAdapter,
      device: AircoDeviceWithMeta,
      resolvedUnitId: number,
    ) => Promise<T>,
    requestedUnitId?: number,
  ): Promise<T> {
    const device = await this.repository.getAircoDeviceById(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const connection = this.requireConnection(device);
    const resolvedUnitId = this.resolveUnitId(device, requestedUnitId);
    const adapter = this.registry.create(connection.type!, connection);

    await adapter.connect();

    try {
      return await fn(adapter, device, resolvedUnitId);
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
    return this.withAdapter(
      deviceId,
      (adapter, _device, resolvedUnitId) =>
        adapter.getSetpoint(resolvedUnitId, zone),
      unitId,
    );
  }

  async setSetpoint(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
    temperature: number,
  ): Promise<void> {
    await this.withAdapter(
      deviceId,
      (adapter, _device, resolvedUnitId) =>
        adapter.setSetpoint(resolvedUnitId, zone, temperature),
      unitId,
    );
  }

  async getVirtualTemperature(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
  ): Promise<number> {
    return this.withAdapter(
      deviceId,
      (adapter, _device, resolvedUnitId) =>
        adapter.getVirtualTemperature(resolvedUnitId, zone),
      unitId,
    );
  }

  async setVirtualTemperature(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
    temperature: number,
  ): Promise<void> {
    await this.withAdapter(
      deviceId,
      (adapter, _device, resolvedUnitId) =>
        adapter.setVirtualTemperature(resolvedUnitId, zone, temperature),
      unitId,
    );
  }

  async getFanSpeed(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
  ): Promise<number> {
    return this.withAdapter(
      deviceId,
      (adapter, _device, resolvedUnitId) =>
        adapter.getFanSpeed(resolvedUnitId, zone),
      unitId,
    );
  }

  async setFanSpeed(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
    speed: number,
  ): Promise<void> {
    await this.withAdapter(
      deviceId,
      (adapter, _device, resolvedUnitId) =>
        adapter.setFanSpeed(resolvedUnitId, zone, speed),
      unitId,
    );
  }

  async getFanMode(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
  ): Promise<number> {
    return this.withAdapter(
      deviceId,
      (adapter, _device, resolvedUnitId) =>
        adapter.getFanMode(resolvedUnitId, zone),
      unitId,
    );
  }

  async setFanMode(
    deviceId: string,
    unitId: number,
    zone: AircoZone,
    mode: number,
  ): Promise<void> {
    await this.withAdapter(
      deviceId,
      (adapter, _device, resolvedUnitId) =>
        adapter.setFanMode(resolvedUnitId, zone, mode),
      unitId,
    );
  }
}
