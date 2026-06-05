import * as jsmodbus from "jsmodbus";
import * as net from "net";
import type { AircoConnection, RegisterType, Zone } from "../../types/shared.types";
import { roundHalf } from "../../utils/helpers";
import type { AircoAdapter } from "./airco-adapter";

const DEVICE_TYPE_A = "FC-500PC/FC-1100PC";
const DEVICE_TYPE_B = "FC-3000DC/FC-3500DC";

export class HopmannAdapterService implements AircoAdapter {
  private connection: AircoConnection;

  constructor(connection: AircoConnection) {
    this.connection = connection;
  }

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  private getDeviceType(): string {
    return String(this.connection.model ?? this.connection.type ?? "");
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

  /**
   * per request:
   * connect -> read/write -> close.
   */
  private async readOrWrite(
    unitId: number,
    register: number,
    type: RegisterType,
    value = 1,
  ): Promise<any> {
    return await new Promise((resolve, reject) => {
      const socket: any = new net.Socket();
      const client: any = new (jsmodbus as any).client.TCP(
        socket,
        Number(unitId),
      );

      let finished = false;

      const cleanup = (): void => {
        try {
          socket.end();
        } catch {
          // ignore
        }

        try {
          socket.destroy();
        } catch {
          // ignore
        }
      };

      const finishResolve = (result: any): void => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(result);
      };

      const finishReject = (error: any): void => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(error);
      };

      socket.setTimeout(this.connection.timeoutMs ?? 5000);

      socket.once("error", finishReject);

      socket.once("timeout", () => {
        finishReject(new Error("hopmann socket timeout"));
      });

      socket.once("connect", async () => {
        try {
          if (type === "readInput") {
            const res = await client.readInputRegisters(register, value);
            const out = res?.response?._body?._values?.[0] ?? 0;

            finishResolve(out);
            return;
          }

          if (type === "writeHold") {
            const res = await client.writeSingleRegister(register, value);

            finishResolve(res);
            return;
          }

          const res = await client.readHoldingRegisters(register, value);
          const out = res?.response?._body?._values?.[0] ?? 0;

          finishResolve(out);
        } catch (error) {
          finishReject(error);
        }
      });

      socket.connect({
        host: this.connection.host,
        port: this.connection.port,
      });
    });
  }

  async setSetpoint(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    void zone;

    const type = this.getDeviceType();

    await this.readOrWrite(
      unitId,
      this.tempRegister(type),
      "writeHold",
      Math.round(temperature * 10),
    );
  }

  async setFanSpeed(unitId: number, zone: Zone, speed: number): Promise<void> {
    void zone;

    const type = this.getDeviceType();
    const encoded = this.encodeFanSpeed(type, speed === -1 ? 2 : speed);

    await this.readOrWrite(
      unitId,
      this.fanRegister(type),
      "writeHold",
      encoded,
    );
  }

  async setFanMode(unitId: number, zone: Zone, mode: number): Promise<void> {
    void zone;

    const type = this.getDeviceType();

    if (!this.hasSeparatePowerRegister(type)) {
      return;
    }

    await this.readOrWrite(
      unitId,
      this.powerRegister(type),
      "writeHold",
      mode === 0 ? 0 : 1,
    );
  }

  async getVirtualTemperature(unitId: number, zone: Zone): Promise<number> {
    void zone;

    if (!this.isBidirectional()) {
      return 0;
    }

    const raw = await this.readOrWrite(unitId, 0, "readInput", 1);

    return roundHalf(Number(raw) / 10);
  }
}

