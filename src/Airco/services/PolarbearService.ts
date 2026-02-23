// TypeScript
import ModbusClient from '../clients/ModbusClient';

const registersV1 = Object.freeze({
  Zone1Setpoint: 601,
  Zone1FanMode: 606,
  Zone1FanSpeed: 607,
  Zone1VirtualTemp: 603,
  Zone2Setpoint: 701,
  Zone2FanMode: 706,
  Zone2FanSpeed: 707,
  Zone2VirtualTemp: 703,
});

const registersV2 = Object.freeze({
  DeviceType: 7001,
  NumberOfZones: 7012,
  Zone1DisplayTemp: 7022,
  Zone1WallGroupTemp: 7023,
  Zone1FloorGroupTemp: 7024,
  Zone1Setpoint: 7025,
  Zone1FanSpeed: 7033,
  Zone2DisplayTemp: 7035,
  Zone2WallGroupTemp: 7036,
  Zone2FloorGroupTemp: 7037,
  Zone2Setpoint: 7038,
  Zone2FanSpeed: 7046,
});

export default class PolarbearService {
  private versionCache = new Map<number, 'v1' | 'v2'>();

  constructor(private client: ModbusClient) {}

  private async detectVersion(unitId: number): Promise<'v1' | 'v2'> {
    if (this.versionCache.has(unitId)) return this.versionCache.get(unitId)!;
    try {
      this.client.setID(unitId);
      await this.client.readHoldingRegisters(registersV2.DeviceType, 1);
      this.versionCache.set(unitId, 'v2');
      return 'v2';
    } catch {
      this.versionCache.set(unitId, 'v1');
      return 'v1';
    }
  }


  async getDeviceType(unitId: number): Promise<number | undefined> {
    this.client.setID(unitId);
    try {
      const res = await this.client.readHoldingRegisters(
        registersV2.DeviceType,
        1,
      );
      const arr = Array.isArray(res) ? res : (res as any).data;
      return arr[0];
    } catch {
      return undefined;
    }
  }

  async getSetpoint(unitId: number, zone: 1 | 2): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.client.readGatewayStatusV2(unitId, zone);
      return status.setpoint;
    } else {
      const register =
        zone === 1 ? registersV1.Zone1Setpoint : registersV1.Zone2Setpoint;
      const data = await this.client.readHoldingRegisters(register, 1);
      const arr = Array.isArray(data) ? data : (data as any).data;
      return arr[0] / 10;
    }
  }

  async setSetpoint(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    this.client.setID(unitId);
    const value = Math.round(temperature * 10);
    const register =
      zone === 1 ? registersV1.Zone1Setpoint : registersV1.Zone2Setpoint;
    await this.client.writeRegister(register, value);
  }

  async getVirtualTemperature(unitId: number, zone: 1 | 2): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.client.readGatewayStatusV2(unitId, zone);
      return status.displayTemp;
    } else {
      const register =
        zone === 1
          ? registersV1.Zone1VirtualTemp
          : registersV1.Zone2VirtualTemp;
      const result = await this.client.readHoldingRegisters(register, 1);
      const arr = Array.isArray(result) ? result : (result as any).data;
      return arr[0] / 10;
    }
  }

  async setVirtualTemperature(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);
    const rawTemp = Math.round(temperature * 10) & 0x03ff; // 10-bit field

    if (version === 'v2') {
      const register =
        zone === 1
          ? registersV2.Zone1DisplayTemp
          : registersV2.Zone2DisplayTemp;
      // read current register to preserve non-temperature bits
      const res = await this.client.readHoldingRegisters(register, 1);
      const arr = Array.isArray(res) ? res : (res as any).data;
      const current = arr[0] ?? 0;
      const newValue = (current & ~0x03ff) | rawTemp;
      await this.client.writeRegister(register, newValue);
    } else {
      const register =
        zone === 1
          ? registersV1.Zone1VirtualTemp
          : registersV1.Zone2VirtualTemp;
      await this.client.writeRegister(register, rawTemp);
    }
  }

  async getFanSpeed(unitId: number, zone: 1 | 2): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.client.readGatewayStatusV2(unitId, zone);
      return status.fanSpeed;
    } else {
      const register =
        zone === 1 ? registersV1.Zone1FanSpeed : registersV1.Zone2FanSpeed;
      const result = await this.client.readHoldingRegisters(register, 1);
      const arr = Array.isArray(result) ? result : (result as any).data;
      return arr[0];
    }
  }

  async getFanMode(unitId: number, zone: 1 | 2): Promise<number> {
    const register =
      zone === 1 ? registersV1.Zone1FanMode : registersV1.Zone2FanMode;
    this.client.setID(unitId);
    const result = await this.client.readHoldingRegisters(register, 1);
    const arr = Array.isArray(result) ? result : (result as any).data;
    return arr[0];
  }
}
