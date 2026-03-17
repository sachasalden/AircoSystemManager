import ModbusClient from '../clients/ModbusClient';

type Zone = 1 | 2;
type FlagType = 'setpoint' | 'fanMode';

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

const inputs = Object.freeze({
  FlagReg0: 110,
  FlagReg7: 117,
  FlagReg8: 118,
});

const flagBits: Record<FlagType, Record<Zone, number>> = Object.freeze({
  setpoint: Object.freeze({
    1: 0,
    2: 8,
  }),
  fanMode: Object.freeze({
    1: 1,
    2: 9,
  }),
});

export default class PolarbearService {
  private versionCache = new Map<number, 'v1' | 'v2'>();

  constructor(private client: ModbusClient) {}

  private getZoneFlagRegister(zone: Zone): number {
    return zone === 1 ? inputs.FlagReg7 : inputs.FlagReg8;
  }

  private getFlagBit(zone: Zone, type: FlagType): number {
    return flagBits[type][zone];
  }

  private async detectVersion(unitId: number): Promise<'v1' | 'v2'> {
    if (this.versionCache.has(unitId)) {
      return this.versionCache.get(unitId)!;
    }

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

  private async updateFlagBit(
    unitId: number,
    zone: Zone,
    type: FlagType,
    enabled: boolean,
    currentFlags?: number,
  ): Promise<void> {
    const bit = this.getFlagBit(zone, type);
    this.client.setID(unitId);

    try {
      if (enabled) {
        await this.client.maskWriteRegister(
          inputs.FlagReg0,
          0xffff,
          (1 << bit) & 0xffff,
        );
      } else {
        await this.client.maskWriteRegister(
          inputs.FlagReg0,
          ~(1 << bit) & 0xffff,
          0x0000,
        );
      }
    } catch {
      const flags = currentFlags ?? (await this.getFlags(unitId));
      const nextValue = enabled ? flags | (1 << bit) : flags & ~(1 << bit);

      if (nextValue === flags) {
        return;
      }

      this.client.setID(unitId);
      await this.client.writeRegister(inputs.FlagReg0, nextValue);
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

  async getSetpoint(unitId: number, zone: Zone): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.client.readGatewayStatusV2(unitId, zone);
      return status.setpoint;
    }

    const register =
      zone === 1 ? registersV1.Zone1Setpoint : registersV1.Zone2Setpoint;
    const data = await this.client.readHoldingRegisters(register, 1);
    const arr = Array.isArray(data) ? data : (data as any).data;
    return arr[0] / 10;
  }

  async setSetpoint(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    this.client.setID(unitId);
    const value = Math.round(temperature * 10);
    const register =
      zone === 1 ? registersV1.Zone1Setpoint : registersV1.Zone2Setpoint;

    await this.client.writeRegister(register, value);
  }

  async getVirtualTemperature(unitId: number, zone: Zone): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.client.readGatewayStatusV2(unitId, zone);
      return status.displayTemp;
    }

    const register =
      zone === 1 ? registersV1.Zone1VirtualTemp : registersV1.Zone2VirtualTemp;
    const result = await this.client.readHoldingRegisters(register, 1);
    const arr = Array.isArray(result) ? result : (result as any).data;
    return arr[0] / 10;
  }

  async setVirtualTemperature(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);
    const rawTemp = Math.round(temperature * 10) & 0x03ff;

    if (version === 'v2') {
      const register =
        zone === 1
          ? registersV2.Zone1DisplayTemp
          : registersV2.Zone2DisplayTemp;

      const res = await this.client.readHoldingRegisters(register, 1);
      const arr = Array.isArray(res) ? res : (res as any).data;
      const current = arr[0] ?? 0;
      const newValue = (current & ~0x03ff) | rawTemp;

      await this.client.writeRegister(register, newValue);
      return;
    }

    const register =
      zone === 1 ? registersV1.Zone1VirtualTemp : registersV1.Zone2VirtualTemp;
    await this.client.writeRegister(register, rawTemp);
  }

  async getFanSpeed(unitId: number, zone: Zone): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.client.readGatewayStatusV2(unitId, zone);
      return status.fanSpeed;
    }

    const register =
      zone === 1 ? registersV1.Zone1FanSpeed : registersV1.Zone2FanSpeed;
    const result = await this.client.readHoldingRegisters(register, 1);
    const arr = Array.isArray(result) ? result : (result as any).data;
    return arr[0];
  }

  async getFanMode(unitId: number, zone: Zone): Promise<number> {
    this.client.setID(unitId);
    const register =
      zone === 1 ? registersV1.Zone1FanMode : registersV1.Zone2FanMode;
    const result = await this.client.readHoldingRegisters(register, 1);
    const arr = Array.isArray(result) ? result : (result as any).data;
    return arr[0];
  }

  async setFanSpeed(unitId: number, zone: Zone, speed: number): Promise<void> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    const register =
      version === 'v2'
        ? zone === 1
          ? registersV2.Zone1FanSpeed
          : registersV2.Zone2FanSpeed
        : zone === 1
          ? registersV1.Zone1FanSpeed
          : registersV1.Zone2FanSpeed;

    await this.client.writeRegister(register, speed);
  }

  async setFanMode(unitId: number, zone: Zone, mode: number): Promise<void> {
    this.client.setID(unitId);
    const register =
      zone === 1 ? registersV1.Zone1FanMode : registersV1.Zone2FanMode;
    await this.client.writeRegister(register, mode);
  }

  async getFlags(unitId: number): Promise<number> {
    this.client.setID(unitId);
    const result = await this.client.readHoldingRegisters(inputs.FlagReg0, 1);
    const arr = Array.isArray(result) ? result : (result as any).data;
    return arr[0];
  }

  isFlagSet(flags: number, zone: Zone, type: FlagType): boolean {
    const bit = this.getFlagBit(zone, type);
    return (flags & (1 << bit)) !== 0;
  }

  async clearFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.updateFlagBit(unitId, zone, type, false, currentFlags);
  }

  async setFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.updateFlagBit(unitId, zone, type, true, currentFlags);
  }

  async getPendingSetpoint(unitId: number, zone: Zone): Promise<number> {
    this.client.setID(unitId);
    const result = await this.client.readHoldingRegisters(
      this.getZoneFlagRegister(zone),
      1,
    );
    const arr = Array.isArray(result) ? result : (result as any).data;
    const value = arr[0] ?? 0;
    const lowBits = (value & 0x00c0) >> 6;
    const highBits = (value & 0xff00) >> 8;

    return ((highBits << 2) | lowBits) / 10;
  }

  async getPendingFanMode(unitId: number, zone: Zone): Promise<number> {
    this.client.setID(unitId);
    const result = await this.client.readHoldingRegisters(
      this.getZoneFlagRegister(zone),
      1,
    );
    const arr = Array.isArray(result) ? result : (result as any).data;
    return (arr[0] ?? 0) & 0x0007;
  }
}
