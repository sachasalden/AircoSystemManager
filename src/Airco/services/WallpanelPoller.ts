import ModbusClient from '../clients/ModbusClient';
import PolarbearService from './PolarbearService';
import type { FlagType, Zone } from './PolarbearService';

export interface ZoneSnapshot {
  setpoint: number;
  fanSpeed: number;
  fanMode: number;
  virtualTemp: number;
}

export interface FullSnapshot {
  unitId: number;
  zone1: ZoneSnapshot;
  zone2: ZoneSnapshot;
  timestamp: string;
}

export interface PollerOptions {
  host: string;
  port: number;
  unitIds: number[];
  unitTypes?: Record<number, string>;
  minInterMessageGapMs?: number;
  timeoutMs?: number;
  reconnectDelayMs?: number;
}

export default class WallpanelPoller {
  private readonly unitIds: number[];
  private readonly client: ModbusClient;
  private readonly service: PolarbearService;
  private connected = false;
  private requestQueue: Promise<unknown> = Promise.resolve();
  private lastReconnectAttemptAt = 0;

  constructor(private readonly options: PollerOptions) {
    this.unitIds = this.normalizeUnitIds(options.unitIds);

    if (!options.host?.trim()) {
      throw new Error('the wallpanel needs a valid host.');
    }

    if (!Number.isFinite(options.port)) {
      throw new Error('The wallpanel needs a valid port number. .');
    }

    if (!this.unitIds.length) {
      throw new Error('give at least one unitId to the wallpanel.');
    }

    this.client = new ModbusClient(
      options.timeoutMs ?? 10000,
      options.minInterMessageGapMs ?? 30,
    );

    this.service = new PolarbearService(this.client, options.unitTypes);
  }

  async stop(): Promise<void> {
    await this.client.disconnect();
    this.connected = false;
  }

  reconnectSoon(): void {
    this.connected = false;
    this.client.markDisconnected();
  }

  async getSnapshot(unitId: number): Promise<FullSnapshot> {
    return this.run(unitId, async () => ({
      unitId,
      zone1: await this.service.getZoneSnapshot(unitId, 1),
      zone2: await this.service.getZoneSnapshot(unitId, 2),
      timestamp: new Date().toISOString(),
    }));
  }

  async getSetpoint(unitId: number, zone: Zone): Promise<number> {
    return this.run(unitId, () => this.service.getSetpoint(unitId, zone));
  }

  async setSetpoint(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    await this.run(unitId, () =>
      this.service.setSetpoint(unitId, zone, temperature),
    );
  }

  async getFanSpeed(unitId: number, zone: Zone): Promise<number> {
    return this.run(unitId, () => this.service.getFanSpeed(unitId, zone));
  }

  async setFanSpeed(unitId: number, zone: Zone, speed: number): Promise<void> {
    await this.run(unitId, () => this.service.setFanSpeed(unitId, zone, speed));
  }

  async getFanMode(unitId: number, zone: Zone): Promise<number> {
    return this.run(unitId, () => this.service.getFanMode(unitId, zone));
  }

  async setFanMode(unitId: number, zone: Zone, mode: number): Promise<void> {
    await this.run(unitId, () => this.service.setFanMode(unitId, zone, mode));
  }

  async getVirtualTemp(unitId: number, zone: Zone): Promise<number> {
    return this.run(unitId, () =>
      this.service.getVirtualTemperature(unitId, zone),
    );
  }

  async setVirtualTemp(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    await this.run(unitId, () =>
      this.service.setVirtualTemperature(unitId, zone, temperature),
    );
  }

  async getFlags(unitId: number): Promise<number> {
    return this.run(unitId, () => this.service.getFlags(unitId));
  }

  async setFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.run(unitId, () =>
      this.service.setFlag(unitId, zone, type, currentFlags),
    );
  }

  async clearFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.run(unitId, () =>
      this.service.clearFlag(unitId, zone, type, currentFlags),
    );
  }

  async getPendingSetpoint(unitId: number, zone: Zone): Promise<number> {
    return this.run(unitId, () =>
      this.service.getPendingSetpoint(unitId, zone),
    );
  }

  async getPendingFanMode(unitId: number, zone: Zone): Promise<number> {
    return this.run(unitId, () => this.service.getPendingFanMode(unitId, zone));
  }

  private async run<T>(unitId: number, task: () => Promise<T>): Promise<T> {
    this.assertUnitConfigured(unitId);

    return this.enqueue(async () => {
      await this.ensureConnected();

      try {
        return await task();
      } catch (error) {
        if (this.isConnectionError(error)) {
          this.connected = false;
          this.client.markDisconnected();
        }

        throw error;
      }
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      const reconnectDelayMs = this.options.reconnectDelayMs ?? 5000;
      const waitMs =
        reconnectDelayMs - (Date.now() - this.lastReconnectAttemptAt);

      if (this.lastReconnectAttemptAt > 0 && waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      this.lastReconnectAttemptAt = Date.now();
      await this.client.connect(this.options.host, this.options.port);
      this.connected = true;
    }
  }

  private assertUnitConfigured(unitId: number): void {
    if (!this.unitIds.includes(unitId)) {
      throw new Error(
        `unitId ${unitId} is not in the configuration. Configuration: ${this.unitIds.join(', ')}`,
      );
    }
  }

  private normalizeUnitIds(unitIds: number[]): number[] {
    return [...new Set(unitIds)].filter(Number.isFinite).sort((a, b) => a - b);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.requestQueue.then(task, task);

    this.requestQueue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
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
}
