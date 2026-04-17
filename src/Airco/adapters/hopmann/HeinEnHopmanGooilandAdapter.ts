import type { AircoAdapter, AircoConnection, AircoZone } from '../IAircoAdapter';
import * as jsmodbus from 'jsmodbus';
import * as net from 'net';

type RegisterType = 'readHold' | 'readInput' | 'writeSingle';

export default class HeinEnHopmanGooilandAdapter implements AircoAdapter {
  constructor(private connection: AircoConnection) {}

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  private isBidirectional(): boolean {
    return this.connection.bidirectional !== false;
  }

  private parseRegisterAddress(value: unknown, label: string): number {
    if (value === undefined || value === null || value === '' || value === -1) {
      throw new Error(`Gooiland adapter missing ${label}`);
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed === -1) {
      throw new Error(`Gooiland adapter invalid ${label}: ${String(value)}`);
    }

    return parsed - 40000;
  }

  private async getRegister(
    unitId: number,
    register: number,
    type: RegisterType,
    value = 1,
  ): Promise<any> {
    return await new Promise((resolve, reject) => {
      const socket: any = new net.Socket();
      const client: any = new jsmodbus.client.TCP(socket, Number(unitId));

      const onError = (err: any) => {
        try {
          socket.end();
          socket.destroy();
        } catch {}
        reject(err);
      };

      socket.setTimeout(this.connection.timeoutMs ?? 5000);
      socket.once('error', onError);
      socket.once('timeout', () => onError(new Error('gooiland socket timeout')));

      socket.once('connect', async () => {
        try {
          if (type === 'readInput') {
            const res = await client.readInputRegisters(register, value);
            const out = res?.response?._body?._values?.[0] ?? 0;
            socket.end();
            resolve(out);
            return;
          }

          if (type === 'writeSingle') {
            const res = await client.writeSingleRegister(register, value);
            socket.end();
            resolve(res);
            return;
          }

          const res = await client.readHoldingRegisters(register, value);
          const out =
            res?.response?._body?._values?.[0] ??
            res?.response?._body?.values?.[0] ??
            0;
          socket.end();
          resolve(out);
        } catch (err) {
          onError(err);
        }
      });

      socket.connect({ host: this.connection.host, port: this.connection.port });
    });
  }

  async getSetpoint(unitId: number, zone: AircoZone): Promise<number> {
    void zone;
    const register = this.parseRegisterAddress(
      this.connection.roomTemparatureSetPointAddress,
      'roomTemparatureSetPointAddress',
    );
    const raw = await this.getRegister(unitId, register, 'readHold', 1);
    return Number(raw) / 10;
  }

  async setSetpoint(
    unitId: number,
    zone: AircoZone,
    temperature: number,
  ): Promise<void> {
    void zone;
    const register = this.parseRegisterAddress(
      this.connection.roomTemparatureSetPointAddress,
      'roomTemparatureSetPointAddress',
    );
    await this.getRegister(
      unitId,
      register,
      'writeSingle',
      Math.round(temperature * 10),
    );
  }

  async getVirtualTemperature(unitId: number, zone: AircoZone): Promise<number> {
    void zone;

    if (!this.isBidirectional()) {
      return await this.getSetpoint(unitId, zone);
    }

    const register = this.parseRegisterAddress(
      this.connection.roomTemparatureAddress,
      'roomTemparatureAddress',
    );
    const raw = await this.getRegister(unitId, register, 'readHold', 1);
    return Number(raw) / 10;
  }

  async setVirtualTemperature(
    unitId: number,
    zone: AircoZone,
    temperature: number,
  ): Promise<void> {
    await this.setSetpoint(unitId, zone, temperature);
  }

  async getFanSpeed(unitId: number, zone: AircoZone): Promise<number> {
    void zone;

    if (
      this.connection.fanspeedAddress === undefined ||
      this.connection.fanspeedAddress === null ||
      this.connection.fanspeedAddress === '' ||
      this.connection.fanspeedAddress === -1
    ) {
      return -1;
    }

    const register = this.parseRegisterAddress(
      this.connection.fanspeedAddress,
      'fanspeedAddress',
    );
    const raw = await this.getRegister(unitId, register, 'readHold', 1);
    return Number(raw) / 10;
  }

  async setFanSpeed(
    unitId: number,
    zone: AircoZone,
    speed: number,
  ): Promise<void> {
    void zone;
    const register = this.parseRegisterAddress(
      this.connection.fanspeedSetPointAddress,
      'fanspeedSetPointAddress',
    );
    await this.getRegister(unitId, register, 'writeSingle', Math.round(speed * 10));
  }

  async getFanMode(unitId: number, zone: AircoZone): Promise<number> {
    return await this.getFanSpeed(unitId, zone);
  }

  async setFanMode(unitId: number, zone: AircoZone, mode: number): Promise<void> {
    await this.setFanSpeed(unitId, zone, mode);
  }
}
