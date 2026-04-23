import ModbusClient from '../clients/ModbusClient';
import PolarbearService from './PolarbearService';

export type Zone = 1 | 2;
export type FlagType = 'setpoint' | 'fanMode';

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
  host?: string;
  port?: number;
  unitId?: number;
  unitIds?: number[];
  minInterMessageGapMs?: number;
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<Omit<PollerOptions, 'unitIds'>> = {
  host: '192.168.55.97',
  port: 4001,
  unitId: 1,
  minInterMessageGapMs: 60,
  timeoutMs: 2000,
};

export default class WallpanelPoller {
  private readonly options: Required<Omit<PollerOptions, 'unitIds'>>;
  private readonly unitIds: number[];
  private readonly client: ModbusClient;
  private readonly service: PolarbearService;
  private connected = false;
  private requestQueue: Promise<unknown> = Promise.resolve();

  constructor(options: PollerOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    const sourceUnitIds = options.unitIds?.length
      ? options.unitIds
      : [options.unitId ?? DEFAULT_OPTIONS.unitId];

    this.unitIds = [...new Set(sourceUnitIds)]
      .filter((unitId) => Number.isFinite(unitId))
      .sort((a, b) => a - b);

    if (!this.unitIds.length) {
      throw new Error('Geef minimaal 1 unitId op.');
    }

    this.client = new ModbusClient(
      this.options.timeoutMs,
      this.options.minInterMessageGapMs,
    );
    this.service = new PolarbearService(this.client);
  }

  async stop(): Promise<void> {
    await this.client.disconnect();
    this.connected = false;
  }

  getConfiguredUnitIds(): number[] {
    return [...this.unitIds];
  }

  async getSnapshot(unitId: number): Promise<FullSnapshot> {
    this.assertUnitConfigured(unitId);
    await this.ensureConnected();

    return this.enqueue(async () => ({
      unitId,
      zone1: await this.readZoneSnapshot(unitId, 1),
      zone2: await this.readZoneSnapshot(unitId, 2),
      timestamp: new Date().toISOString(),
    }));
  }

  async getAllSnapshots(): Promise<FullSnapshot[]> {
    await this.ensureConnected();

    const snapshots: FullSnapshot[] = [];
    for (const unitId of this.unitIds) {
      snapshots.push(await this.getSnapshot(unitId));
    }

    return snapshots;
  }

  async getSetpoint(unitId: number, zone: Zone): Promise<number> {
    return this.runForUnit(unitId, () => this.service.getSetpoint(unitId, zone));
  }

  async setSetpoint(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    await this.runForUnit(unitId, () =>
      this.service.setSetpoint(unitId, zone, temperature),
    );
  }

  async getFanSpeed(unitId: number, zone: Zone): Promise<number> {
    return this.runForUnit(unitId, () => this.service.getFanSpeed(unitId, zone));
  }

  async setFanSpeed(unitId: number, zone: Zone, speed: number): Promise<void> {
    await this.runForUnit(unitId, () =>
      this.service.setFanSpeed(unitId, zone, speed),
    );
  }

  async getFanMode(unitId: number, zone: Zone): Promise<number> {
    return this.runForUnit(unitId, () => this.service.getFanMode(unitId, zone));
  }

  async setFanMode(unitId: number, zone: Zone, mode: number): Promise<void> {
    await this.runForUnit(unitId, () =>
      this.service.setFanMode(unitId, zone, mode),
    );
  }

  async getVirtualTemp(unitId: number, zone: Zone): Promise<number> {
    return this.runForUnit(unitId, () =>
      this.service.getVirtualTemperature(unitId, zone),
    );
  }

  async setVirtualTemp(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    await this.runForUnit(unitId, () =>
      this.service.setVirtualTemperature(unitId, zone, temperature),
    );
  }

  async getFlags(unitId: number): Promise<number> {
    return this.runForUnit(unitId, () => this.service.getFlags(unitId));
  }

  async setFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.runForUnit(unitId, () =>
      this.service.setFlag(unitId, zone, type, currentFlags),
    );
  }

  async clearFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.runForUnit(unitId, () =>
      this.service.clearFlag(unitId, zone, type, currentFlags),
    );
  }

  async getPendingSetpoint(unitId: number, zone: Zone): Promise<number> {
    return this.runForUnit(unitId, () =>
      this.service.getPendingSetpoint(unitId, zone),
    );
  }

  async getPendingFanMode(unitId: number, zone: Zone): Promise<number> {
    return this.runForUnit(unitId, () =>
      this.service.getPendingFanMode(unitId, zone),
    );
  }

  private async readZoneSnapshot(
    unitId: number,
    zone: Zone,
  ): Promise<ZoneSnapshot> {
    return {
      setpoint: await this.service.getSetpoint(unitId, zone),
      fanSpeed: await this.service.getFanSpeed(unitId, zone),
      fanMode: await this.service.getFanMode(unitId, zone),
      virtualTemp: await this.service.getVirtualTemperature(unitId, zone),
    };
  }

  private async runForUnit<T>(
    unitId: number,
    task: () => Promise<T>,
  ): Promise<T> {
    this.assertUnitConfigured(unitId);
    await this.ensureConnected();

    return this.enqueue(task);
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect(this.options.host, this.options.port);
    this.connected = true;
  }

  private assertUnitConfigured(unitId: number): void {
    if (!this.unitIds.includes(unitId)) {
      throw new Error(
        `unitId ${unitId} staat niet in de configuratie. Geconfigureerd: ${this.unitIds.join(', ')}`,
      );
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.requestQueue.then(task, task);

    this.requestQueue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }
}
