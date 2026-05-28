import ModbusRTU from 'modbus-serial';

export default class ModbusClient {
  private client: any;
  private connected = false;
  private lastHost?: string;
  private lastPort?: number;
  private lastRequestAt = 0;
  private requestQueue: Promise<unknown> = Promise.resolve();
  private connectPromise: Promise<void> | null = null;

  constructor(
    private timeout = 10000,
    private requestGapMs = 0,
  ) {
    this.client = this.createClient();
  }

  private createClient(): any {
    const client = new ModbusRTU();
    client.setTimeout(this.timeout);

    return client;
  }

  async connect(host: string, port: number): Promise<void> {
    this.lastHost = host;
    this.lastPort = port;

    if (this.connected) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      (this.client as any).connectTelnet(host, { port }, (error: unknown) => {
        this.connectPromise = null;

        if (error) {
          this.connected = false;
          reject(error);
          return;
        }

        this.connected = true;
        resolve();
      });
    });

    return this.connectPromise;
  }

  async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => {
      try {
        this.client.close(() => {
          this.connected = false;
          this.connectPromise = null;
          resolve();
        });
      } catch {
        this.connected = false;
        this.connectPromise = null;
        resolve();
      }
    });
  }

  async close(): Promise<void> {
    await this.disconnect();
  }

  markDisconnected(): void {
    this.connected = false;
    this.connectPromise = null;
    this.resetClient();
  }

  setID(id: number): void {
    this.client.setID(id);
  }

  async readHoldingRegisters(register: number, count = 1): Promise<number[]> {
    return this.enqueue(async () => {
      await this.ensureConnected();
      await this.waitForRequestGap();

      try {
        const result = await this.client.readHoldingRegisters(register, count);
        this.lastRequestAt = Date.now();

        return result.data;
      } catch (error) {
        this.handleOperationError(error);
        throw error;
      }
    });
  }

  async writeRegister(register: number, value: number): Promise<void> {
    await this.enqueue(async () => {
      await this.ensureConnected();
      await this.waitForRequestGap();

      try {
        await this.client.writeRegister(register, value);
        this.lastRequestAt = Date.now();
      } catch (error) {
        this.handleOperationError(error);
        throw error;
      }
    });
  }

  async writeCoil(coil: number, value: boolean): Promise<void> {
    await this.enqueue(async () => {
      await this.ensureConnected();
      await this.waitForRequestGap();

      try {
        await this.client.writeCoil(coil, value);
        this.lastRequestAt = Date.now();
      } catch (error) {
        this.handleOperationError(error);
        throw error;
      }
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (!this.lastHost || this.lastPort === undefined) {
      throw new Error('Modbus client is not connected');
    }

    await this.connect(this.lastHost, this.lastPort);
  }

  private handleOperationError(error: unknown): void {
    if (this.isConnectionError(error)) {
      this.markDisconnected();
    }
  }

  private resetClient(): void {
    try {
      this.client.close(() => undefined);
    } catch {}

    this.client = this.createClient();
  }

  private isConnectionError(error: unknown): boolean {
    const err = error as { name?: string; message?: string; errno?: string; code?: string };
    const text = `${err?.name ?? ''} ${err?.message ?? ''} ${err?.errno ?? ''} ${err?.code ?? ''}`.toLowerCase();

    return (
      text.includes('port not open') ||
      text.includes('not open') ||
      text.includes('econnrefused') ||
      text.includes('econnreset') ||
      text.includes('epipe') ||
      text.includes('socket closed') ||
      text.includes('connection closed')
    );
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.requestQueue.then(task, task);

    this.requestQueue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  private async waitForRequestGap(): Promise<void> {
    const waitMs = this.requestGapMs - (Date.now() - this.lastRequestAt);

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
