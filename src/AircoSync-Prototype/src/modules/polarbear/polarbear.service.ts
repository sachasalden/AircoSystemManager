import { BAUDRATE_VALUES, COILS, FLAG_BITS, INPUTS, REGISTERS } from "../../config/runtime.config";
import type { FlagType, VirtualTemperatureTarget, Zone } from "../../types/shared.types";
import { decodePendingSetpoint, encodeTemperature, formatError, log, normalizeFanMode, roundHalf, sleep, zoneFlagRegister, zoneRegister } from "../../utils/helpers";
import { ModbusClient } from "../modbus/modbus.client";

export class PolarbearService {
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
      `virtualTemp written ${target.name} unit=${target.unitId} zone=${target.zone} register=${target.register} value=${rounded} encoded=${encoded}`,
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

    log(`polarbear baudrate install ${baudrate} encoded=${encodedValue}`);

    for (const unitId of unitIds) {
      log(`polarbear baudrate request unit=${unitId}`);
      this.client.setId(unitId);
      await this.client.write(REGISTERS.baudRate, encodedValue);
      log(`polarbear baudrate set unit=${unitId} value=${baudrate}`);
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
          `polarbear reboot response ignored unit=${unitId}: ${formatError(error)}`,
        );
      }

      log(`polarbear reboot started unit=${unitId}`);
      await sleep(500);
    }
  }
}
