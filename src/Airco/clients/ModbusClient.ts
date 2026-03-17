import ModbusRTU from 'modbus-serial';

export default class ModbusClient {
  private client: ModbusRTU;
  private connected = false;
  private reconnecting = false;
  private reconnectDelay = 5000;
  private lastHost?: string;
  private lastPort?: number;

  constructor(private timeout = 10000) {
    this.client = new ModbusRTU();
    this.client.setTimeout(this.timeout);
  }

  async connect(host: string, port: number): Promise<void> {
    this.lastHost = host;
    this.lastPort = port;

    if (this.connected) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      (this.client as any).connectTelnet(host, { port }, (err: any) => {
        if (err) {
          this.connected = false;
          return reject(err);
        }

        this.connected = true;
        this.reconnecting = false;
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.client.close(() => {
        this.connected = false;
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    await this.disconnect();
  }

  handleReconnect(): void {
    if (this.reconnecting) {
      return;
    }

    if (!this.lastHost || this.lastPort === undefined) {
      console.warn('Connection lost. No stored host/port to reconnect to.');
      return;
    }

    this.reconnecting = true;
    this.connected = false;

    console.warn('Connection lost. Attempting to reconnect...');

    setTimeout(() => {
      this.connect(this.lastHost!, this.lastPort!)
        .then(() => {
          console.log('Reconnected successfully');
        })
        .catch((err) => {
          console.error('Reconnection failed:', err.message || err);
          this.reconnecting = false;
        });
    }, this.reconnectDelay);
  }

  setID(id: number): void {
    this.client.setID(id);
  }

  async readHoldingRegisters(register: number, count = 1): Promise<number[]> {
    const res = await this.client.readHoldingRegisters(register, count);
    return res.data;
  }

  async writeRegister(register: number, value: number): Promise<void> {
    await this.client.writeRegister(register, value);
  }

  async maskWriteRegister(
    register: number,
    andMask: number,
    orMask: number,
  ): Promise<void> {
    await (this.client as any).maskWriteRegister(register, andMask, orMask);
  }

  async readGatewayStatusV2(unitId: number, zone: 1 | 2) {
    this.client.setID(unitId);

    const raw = await this.client.readHoldingRegisters(7001, 47);
    const data: number[] = Array.isArray(raw) ? raw : (raw as any).data;

    const zoneOffset = zone === 1 ? 21 : 34;

    return {
      displayTemp: (data[zoneOffset] & 0x03ff) / 10,
      wallGroupTemp: (data[zoneOffset + 1] & 0x03ff) / 10,
      floorGroupTemp: (data[zoneOffset + 2] & 0x03ff) / 10,
      setpoint: (data[zoneOffset + 3] & 0x03ff) / 10,
      fanSpeed: data[zoneOffset + 11] & 0x07,
    };
  }
}