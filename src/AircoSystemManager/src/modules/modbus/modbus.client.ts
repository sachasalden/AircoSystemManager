import ModbusRTU from "modbus-serial";
import { sleep } from "../../utils/helpers";

export class ModbusClient {
  private client = new ModbusRTU();
  private connected = false;
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private requestGapMs: number;

  constructor(timeoutMs: number, requestGapMs: number) {
    this.requestGapMs = requestGapMs;
    this.client.setTimeout(timeoutMs);
  }

  async connect(host: string, port: number): Promise<void> {
    if (this.connected) return;

    await new Promise<void>((resolve, reject) => {
      (this.client as any).connectTelnet(host, { port }, (error: any) => {
        if (error) {
          this.connected = false;
          reject(error);
          return;
        }

        this.connected = true;
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.connected) return;

    await new Promise<void>((resolve) => {
      this.client.close(() => {
        this.connected = false;
        resolve();
      });
    });
  }

  setId(unitId: number): void {
    this.client.setID(unitId);
  }

  async read(register: number, count = 1): Promise<number[]> {
    return this.enqueue(async () => {
      await this.waitForGap();

      const response = await this.client.readHoldingRegisters(register, count);
      this.lastRequestAt = Date.now();

      return response.data;
    });
  }

  async write(register: number, value: number): Promise<void> {
    await this.enqueue(async () => {
      await this.waitForGap();

      await this.client.writeRegister(register, value);
      this.lastRequestAt = Date.now();
    });
  }

  async writeCoil(coil: number, value: boolean): Promise<void> {
    await this.enqueue(async () => {
      await this.waitForGap();

      await this.client.writeCoil(coil, value);
      this.lastRequestAt = Date.now();
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);

    this.queue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  private async waitForGap(): Promise<void> {
    if (this.requestGapMs <= 0) return;

    const elapsed = Date.now() - this.lastRequestAt;
    const waitMs = this.requestGapMs - elapsed;

    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }
}

