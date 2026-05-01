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
    return this.runZoneRead(unitId, zone, (targetUnitId, targetZone) =>
      this.service.getSetpoint(targetUnitId, targetZone),
    );
  }

  async setSetpoint(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    await this.runZoneWrite(unitId, zone, (targetUnitId, targetZone) =>
      this.service.setSetpoint(targetUnitId, targetZone, temperature),
    );
  }

  async getFanSpeed(unitId: number, zone: Zone): Promise<number> {
    return this.runZoneRead(unitId, zone, (targetUnitId, targetZone) =>
      this.service.getFanSpeed(targetUnitId, targetZone),
    );
  }

  async setFanSpeed(unitId: number, zone: Zone, speed: number): Promise<void> {
    await this.runZoneWrite(unitId, zone, (targetUnitId, targetZone) =>
      this.service.setFanSpeed(targetUnitId, targetZone, speed),
    );
  }

  async getFanMode(unitId: number, zone: Zone): Promise<number> {
    return this.runZoneRead(unitId, zone, (targetUnitId, targetZone) =>
      this.service.getFanMode(targetUnitId, targetZone),
    );
  }

  async setFanMode(unitId: number, zone: Zone, mode: number): Promise<void> {
    await this.runZoneWrite(unitId, zone, (targetUnitId, targetZone) =>
      this.service.setFanMode(targetUnitId, targetZone, mode),
    );
  }

  async getVirtualTemp(unitId: number, zone: Zone): Promise<number> {
    return this.runZoneRead(unitId, zone, (targetUnitId, targetZone) =>
      this.service.getVirtualTemperature(targetUnitId, targetZone),
    );
  }

  async setVirtualTemp(
    unitId: number,
    zone: Zone,
    temperature: number,
  ): Promise<void> {
    await this.runZoneWrite(unitId, zone, (targetUnitId, targetZone) =>
      this.service.setVirtualTemperature(targetUnitId, targetZone, temperature),
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
    await this.runZoneWrite(unitId, zone, (targetUnitId, targetZone) =>
      this.service.setFlag(targetUnitId, targetZone, type, currentFlags),
    );
  }

  async clearFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    currentFlags?: number,
  ): Promise<void> {
    await this.runZoneWrite(unitId, zone, (targetUnitId, targetZone) =>
      this.service.clearFlag(targetUnitId, targetZone, type, currentFlags),
    );
  }

  async getPendingSetpoint(unitId: number, zone: Zone): Promise<number> {
    return this.runZoneRead(unitId, zone, (targetUnitId, targetZone) =>
      this.service.getPendingSetpoint(targetUnitId, targetZone),
    );
  }

  async getPendingFanMode(unitId: number, zone: Zone): Promise<number> {
    return this.runZoneRead(unitId, zone, (targetUnitId, targetZone) =>
      this.service.getPendingFanMode(targetUnitId, targetZone),
    );
  }

  private async readZoneSnapshot(
    unitId: number,
    zone: Zone,
  ): Promise<ZoneSnapshot> {
    return this.service.getZoneSnapshot(unitId, zone);
  }

  private runZoneRead<T>(
    unitId: number,
    zone: Zone,
    task: (unitId: number, zone: Zone) => Promise<T>,
  ): Promise<T> {
    return this.runForUnit(unitId, () => task(unitId, zone));
  }

  private runZoneWrite(
    unitId: number,
    zone: Zone,
    task: (unitId: number, zone: Zone) => Promise<void>,
  ): Promise<void> {
    return this.runForUnit(unitId, () => task(unitId, zone));
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
