import { AircoAdapter, AircoConnection, AircoZone } from '../IAircoAdapter';
import * as jsmodbus from 'jsmodbus';
import * as net from 'net';


const DEVICE_TYPE_A = 'FC-500PC/FC-1100PC';
const DEVICE_TYPE_B = 'FC-3000DC/FC-3500DC';
type RegisterType = 'readInput' | 'readHold' | 'writeHold';

export default class HopmannAdapter implements AircoAdapter {
  constructor(private connection: AircoConnection) {}

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  private getDeviceType(): string {
    return String(this.connection.model ?? this.connection.type ?? '');
  }

  private isBidirectional(): boolean {
    return this.connection.bidirectional !== false;
  }

  private isTypeA(type: string): boolean {
    return type === DEVICE_TYPE_A;
  }

  private isTypeB(type: string): boolean {
    return type === DEVICE_TYPE_B;
  }

  private tempRegister(type: string): number {
    return this.isTypeA(type) || this.isTypeB(type) ? 0 : 100;
  }

  private fanRegister(type: string): number {
    if (this.isTypeA(type)) return 2;
    if (this.isTypeB(type)) return 1;
    return 102;
  }

  private powerRegister(type: string): number {
    if (this.isTypeA(type)) return 1;
    if (this.isTypeB(type)) return 2;
    return 102;
  }

  private hasSeparatePowerRegister(type: string): boolean {
    return this.isTypeA(type) || this.isTypeB(type);
  }

  private encodeFanSpeed(type: string, speed: number): number {
    if (this.isTypeA(type) || this.isTypeB(type)) return speed;
    return speed * 10;
  }

  private decodeFanSpeed(type: string, raw: any): number {
    const value = Array.isArray(raw)
      ? Number(raw[0] ?? 0)
      : typeof raw === 'number'
      ? raw
      : Number(raw?.response?._body?._values?.[0] ?? 0);

    if (this.isTypeA(type) || this.isTypeB(type)) return value;
    return value / 10;
  }

  private async readOrWrite(
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

      socket.setTimeout(5000);
      socket.once('error', onError);
      socket.once('timeout', () => onError(new Error('hopmann socket timeout')));

      socket.once('connect', async () => {
        try {
          if (type === 'readInput') {
            const res = await client.readInputRegisters(register, value);
            const out = res?.response?._body?._values?.[0] ?? 0;
            socket.end();
            resolve(out);
            return;
          }

          if (type === 'writeHold') {
            const res = await client.writeSingleRegister(register, value);
            socket.end();
            resolve(res);
            return;
          }

          const res = await client.readHoldingRegisters(register, value);
          const out = res?.response?._body?._values?.[0] ?? 0;
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
    void unitId;
    void zone;
    const setpoint = Number(this.connection.setTemperature);

    if (Number.isFinite(setpoint)) {
      return setpoint;
    }

    return Number(this.connection.currentTemperature ?? 0);
  }

  async setSetpoint(
    unitId: number,
    zone: AircoZone,
    temperature: number,
  ): Promise<void> {
    void zone;
    const type = this.getDeviceType();
    await this.readOrWrite(
      unitId,
      this.tempRegister(type),
      'writeHold',
      Math.round(temperature * 10),
    );
  }

  async getVirtualTemperature(unitId: number, zone: AircoZone): Promise<number> {
    void zone;

    if (!this.isBidirectional()) {
      return await this.getSetpoint(unitId, zone);
    }

    const raw = await this.readOrWrite(unitId, 0, 'readInput', 1);
    return Number(raw) / 10;
  }

  async setVirtualTemperature(
    unitId: number,
    zone: AircoZone,
    temperature: number,
  ): Promise<void> {
    // hopmann legacy flow writes one temperature datapath; mirror setpoint write.
    await this.setSetpoint(unitId, zone, temperature);
  }

  async getFanSpeed(unitId: number, zone: AircoZone): Promise<number> {
    void zone;
    const type = this.getDeviceType();
    const raw = await this.readOrWrite(unitId, this.fanRegister(type), 'readHold', 1);
    return this.decodeFanSpeed(type, raw);
  }

  async setFanSpeed(
    unitId: number,
    zone: AircoZone,
    speed: number,
  ): Promise<void> {
    void zone;
    const type = this.getDeviceType();

    const encoded = this.encodeFanSpeed(type, speed === -1 ? 2 : speed);
    await this.readOrWrite(unitId, this.fanRegister(type), 'writeHold', encoded);
  }

  async getFanMode(unitId: number, zone: AircoZone): Promise<number> {
    void zone;
    const type = this.getDeviceType();

    if (!this.hasSeparatePowerRegister(type)) {
      return 1;
    }

    const raw = await this.readOrWrite(
      unitId,
      this.powerRegister(type),
      'readHold',
      1,
    );

    return Number(raw) === 0 ? 0 : 1;
  }

  async setFanMode(unitId: number, zone: AircoZone, mode: number): Promise<void> {
    void zone;
    const type = this.getDeviceType();

    if (!this.hasSeparatePowerRegister(type)) {
      return;
    }

    await this.readOrWrite(
      unitId,
      this.powerRegister(type),
      'writeHold',
      mode === 0 ? 0 : 1,
    );
  }
}
