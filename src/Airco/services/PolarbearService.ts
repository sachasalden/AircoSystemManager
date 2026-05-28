import ModbusClient from '../clients/ModbusClient';

export type Zone = 1 | 2;
export type FlagType = 'setpoint' | 'fanMode';

export type PolarbearZoneSnapshot = {
  setpoint: number;
  virtualTemp: number;
  fanSpeed: number;
  fanMode: number;
};

const REGISTERS_V1 = {
  zone1Setpoint: 601,
  zone1FanMode: 606,
  zone1FanSpeed: 607,
  zone1VirtualTemp: 603,
  zone2Setpoint: 701,
  zone2FanMode: 706,
  zone2FanSpeed: 707,
  zone2VirtualTemp: 703,
} as const;

const REGISTERS_V2 = {
  deviceType: 7001,
  zone1DisplayTemp: 21051,
  zone2DisplayTemp: 22051,
} as const;

const INPUTS = {
  flags: 110,
  zone1Flags: 117,
  zone2Flags: 118,
} as const;

const ADMIN = {
  baudRate: 9002,
  reboot: 9991,
} as const;

const BAUDRATE_VALUES: Record<number, number> = {
  9600: 2,
  19200: 3,
  57600: 4,
  115200: 5,
};

const FLAG_BITS: Record<FlagType, Record<Zone, number>> = {
  setpoint: { 1: 0, 2: 8 },
  fanMode: { 1: 1, 2: 9 },
};

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export default class PolarbearService {
  private detectedVersions = new Map<number, 'v1' | 'v2'>();

  constructor(
    private client: ModbusClient,
    private configuredUnitTypes: Record<number, string> = {},
  ) {}

  async getSetpoint(unitId: number, zone: Zone): Promise<number> {
    return this.readTemperature(unitId, this.zoneRegister(zone, REGISTERS_V1.zone1Setpoint, REGISTERS_V1.zone2Setpoint));
  }

  async setSetpoint(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    await this.writeTemperature(
      unitId,
      this.zoneRegister(zone, REGISTERS_V1.zone1Setpoint, REGISTERS_V1.zone2Setpoint),
      temperature,
    );
  }

  async getVirtualTemperature(unitId: number, zone: Zone): Promise<number> {
    const version = await this.detectVersion(unitId);

    if (version === 'v2') {
      const value = await this.readRegister(
        unitId,
        this.zoneRegister(zone, REGISTERS_V2.zone1DisplayTemp, REGISTERS_V2.zone2DisplayTemp),
      );

      return roundHalf((value & 0x03ff) / 10);
    }

    return roundHalf(await this.readTemperature(
      unitId,
      this.zoneRegister(zone, REGISTERS_V1.zone1VirtualTemp, REGISTERS_V1.zone2VirtualTemp),
    ));
  }

  async setVirtualTemperature(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    const version = await this.detectVersion(unitId);
    const rawTemp = Math.round(temperature * 10);

    if (version === 'v2') {
      const register = this.zoneRegister(
        zone,
        REGISTERS_V2.zone1DisplayTemp,
        REGISTERS_V2.zone2DisplayTemp,
      );

      const current = await this.readRegister(unitId, register);
      await this.writeRegister(unitId, register, (current & ~0x03ff) | (rawTemp & 0x03ff));
      return;
    }

    await this.writeRegister(
      unitId,
      this.zoneRegister(zone, REGISTERS_V1.zone1VirtualTemp, REGISTERS_V1.zone2VirtualTemp),
      rawTemp,
    );
  }

  async getFanSpeed(unitId: number, zone: Zone): Promise<number> {
    return this.readRegister(
      unitId,
      this.zoneRegister(zone, REGISTERS_V1.zone1FanSpeed, REGISTERS_V1.zone2FanSpeed),
    );
  }

  async setFanSpeed(unitId: number, zone: Zone, speed: number): Promise<void> {
    await this.writeRegister(
      unitId,
      this.zoneRegister(zone, REGISTERS_V1.zone1FanSpeed, REGISTERS_V1.zone2FanSpeed),
      speed,
    );
  }

  async getFanMode(unitId: number, zone: Zone): Promise<number> {
    const value = await this.readRegister(
      unitId,
      this.zoneRegister(zone, REGISTERS_V1.zone1FanMode, REGISTERS_V1.zone2FanMode),
    );

    return this.normalizeFanMode(value);
  }

  async setFanMode(unitId: number, zone: Zone, mode: number): Promise<void> {
    await this.writeRegister(
      unitId,
      this.zoneRegister(zone, REGISTERS_V1.zone1FanMode, REGISTERS_V1.zone2FanMode),
      this.normalizeFanMode(mode),
    );
  }

  async getFlags(unitId: number): Promise<number> {
    return this.readRegister(unitId, INPUTS.flags);
  }

  async setFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.updateFlag(unitId, zone, type, currentFlags, 'set');
  }

  async clearFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.updateFlag(unitId, zone, type, currentFlags, 'clear');
  }

  async getPendingSetpoint(unitId: number, zone: Zone): Promise<number> {
    const value = await this.readRegister(unitId, this.zoneFlagRegister(zone));
    const lowBits = (value & 0x00c0) >> 6;
    const highBits = (value & 0xff00) >> 8;

    return ((highBits << 2) | lowBits) / 10;
  }

  async getPendingFanMode(unitId: number, zone: Zone): Promise<number> {
    const value = await this.readRegister(unitId, this.zoneFlagRegister(zone));

    return this.normalizeFanMode(value & 0x0007);
  }

  async getZoneSnapshot(
    unitId: number,
    zone: Zone,
  ): Promise<PolarbearZoneSnapshot> {
    return {
      setpoint: await this.getSetpoint(unitId, zone),
      virtualTemp: await this.getVirtualTemperature(unitId, zone),
      fanSpeed: await this.getFanSpeed(unitId, zone),
      fanMode: await this.getFanMode(unitId, zone),
    };
  }

  async getSnapshot(unitId: number, zone: Zone) {
    const zoneSnapshot = await this.getZoneSnapshot(unitId, zone);

    return {
      setpoint: zoneSnapshot.setpoint,
      virtualTemperature: zoneSnapshot.virtualTemp,
      fanSpeed: zoneSnapshot.fanSpeed,
      fanMode: zoneSnapshot.fanMode,
      flags: await this.getFlags(unitId),
      pendingSetpoint: await this.getPendingSetpoint(unitId, zone),
      pendingFanMode: await this.getPendingFanMode(unitId, zone),
    };
  }

  async reboot(unitId: number): Promise<void> {
    this.client.setID(unitId);
    await this.client.writeCoil(ADMIN.reboot, true);
  }

  async setBaudrate(unitId: number, baudrate: number): Promise<void> {
    const value = BAUDRATE_VALUES[baudrate];

    if (value === undefined) {
      throw new Error(
        `Unsupported baudrate: ${baudrate}. Supported: ${Object.keys(
          BAUDRATE_VALUES,
        ).join(', ')}`,
      );
    }

    await this.writeRegister(unitId, ADMIN.baudRate, value);
  }

  private async detectVersion(unitId: number): Promise<'v1' | 'v2'> {
    const configuredType = this.configuredUnitTypes[unitId];

    if (configuredType) {
      return configuredType === 'polarbear-v1' ? 'v1' : 'v2';
    }

    const cached = this.detectedVersions.get(unitId);

    if (cached) {
      return cached;
    }

    try {
      await this.readRegister(unitId, REGISTERS_V2.deviceType);
      this.detectedVersions.set(unitId, 'v2');
      return 'v2';
    } catch {
      this.detectedVersions.set(unitId, 'v1');
      return 'v1';
    }
  }

  private async updateFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags: number | undefined,
    action: 'set' | 'clear',
  ): Promise<void> {
    const flags = currentFlags ?? (await this.getFlags(unitId));
    const bit = 1 << FLAG_BITS[type][zone];
    const nextFlags = action === 'set' ? flags | bit : flags & ~bit;

    if (nextFlags !== flags) {
      await this.writeRegister(unitId, INPUTS.flags, nextFlags);
    }
  }

  private async readTemperature(unitId: number, register: number): Promise<number> {
    return (await this.readRegister(unitId, register)) / 10;
  }

  private async writeTemperature(
    unitId: number,
    register: number,
    temperature: number,
  ): Promise<void> {
    await this.writeRegister(unitId, register, Math.round(temperature * 10));
  }

  private async readRegister(unitId: number, register: number): Promise<number> {
    this.client.setID(unitId);
    const [value = 0] = await this.client.readHoldingRegisters(register, 1);

    return value;
  }

  private async writeRegister(
    unitId: number,
    register: number,
    value: number,
  ): Promise<void> {
    this.client.setID(unitId);
    await this.client.writeRegister(register, value);
  }

  private zoneRegister(zone: Zone, zone1: number, zone2: number): number {
    return zone === 1 ? zone1 : zone2;
  }

  private zoneFlagRegister(zone: Zone): number {
    return zone === 1 ? INPUTS.zone1Flags : INPUTS.zone2Flags;
  }

  private normalizeFanMode(mode: number): number {
    return Number(mode) === 0 ? 0 : 1;
  }
}
