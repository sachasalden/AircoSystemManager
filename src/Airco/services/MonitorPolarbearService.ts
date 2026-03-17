import ModbusClient from '../clients/ModbusClient';
import { AircopanelRepository, type Device } from '../repositories/WallpanelRepository';
import type SyncEchoGuard from './SyncEchoGuard';
import {
  SYNC_PROPERTIES,
  createDeviceStateKey,
  sameNumericValue,
  type SyncMessage,
  type SyncProperty,
  type Zone,
} from './SyncTypes';
import PolarbearService from './PolarbearService';

type DeviceRow = Device & {
  zoneId: string;
  roomId: string;
};

type Snapshot = Record<SyncProperty, number>;
type ConnectionKey = string;

export default class MonitorPolarbearService {
  private readonly TEST_ZONE_ID = '691ee9f917ddcc79daf9fe84';
  private readonly TEST_ROOM_ID = '2134af85-4377-2330-af2d-72143bec6574';
  private timer: NodeJS.Timeout | null = null;
  private isTickRunning = false;
  private lastSeenState = new Map<string, number>();

  private connections = new Map<
    ConnectionKey,
    { client: ModbusClient; service: PolarbearService; isConnected: boolean }
  >();

  private connQueue = new Map<ConnectionKey, Promise<unknown>>();

  constructor(
    private repository: AircopanelRepository,
    private onStateChange?: (message: SyncMessage) => Promise<void>,
    private echoGuard?: SyncEchoGuard,
    private pollIntervalMs = 5000,
    private modbusTimeoutMs = 10000,
    private requestGapMs = 150,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tickSafe();
    }, this.pollIntervalMs);

    console.log('[MonitorPolarbearService] started');
  }

  async applyRemoteChange(message: SyncMessage): Promise<void> {
    const devices = (await this.repository.getDevices()).filter(
      (device) =>
        device.zoneId === this.TEST_ZONE_ID &&
        device.roomId === this.TEST_ROOM_ID,
    );
    const targets = devices.filter(
      (device) =>
        device.zoneId === message.zoneId && device.roomId === message.roomId,
    );

    for (const device of targets) {
      try {
        const connKey = this.getConnKey(device.ip, device.port);
        const conn = await this.ensureConnection(device.ip, device.port);

        for (const unitId of this.normalizeUnitIds(device.ids)) {
          this.echoGuard?.expectEcho(
            'panel',
            device.id,
            unitId,
            message.zone,
            message.property,
            message.value,
          );

          await this.enqueueWithGap(connKey, () =>
            this.writeProperty(
              conn.service,
              unitId,
              message.zone,
              message.property,
              message.value,
            ),
          );

          this.lastSeenState.set(
            createDeviceStateKey(
              'panel',
              device.id,
              unitId,
              message.zone,
              message.property,
            ),
            message.value,
          );
        }
      } catch (error) {
        console.error(
          `[MonitorPolarbearService] failed to apply ${message.property}=${message.value} to device ${device.id}`,
          error,
        );
      }
    }
  }

  private async tickSafe(): Promise<void> {
    if (this.isTickRunning) {
      return;
    }

    this.isTickRunning = true;

    try {
      await this.tick();
    } finally {
      this.isTickRunning = false;
    }
  }

  private getConnKey(ip: string, port: number): string {
    return `${ip}:${port}`;
  }

  private normalizeUnitIds(ids: number[]): number[] {
    return [...new Set((ids || []).map(Number))].filter((unitId) =>
      Number.isFinite(unitId),
    );
  }

  private enqueue<T>(connKey: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.connQueue.get(connKey) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(fn);

    this.connQueue.set(
      connKey,
      next.then(() => undefined).catch(() => undefined),
    );

    return next;
  }

  private enqueueWithGap<T>(connKey: string, fn: () => Promise<T>): Promise<T> {
    return this.enqueue(connKey, async () => {
      const result = await fn();
      await new Promise((resolve) => setTimeout(resolve, this.requestGapMs));
      return result;
    });
  }

  private async ensureConnection(ip: string, port: number) {
    const key = this.getConnKey(ip, port);

    if (!this.connections.has(key)) {
      const client = new ModbusClient(this.modbusTimeoutMs);
      const service = new PolarbearService(client);
      this.connections.set(key, { client, service, isConnected: false });
    }

    const conn = this.connections.get(key)!;

    if (!conn.isConnected) {
      await conn.client.connect(ip, port);
      conn.isConnected = true;
    }

    return conn;
  }

  private async tick(): Promise<void> {
    const devices = (await this.repository.getDevices()).filter(
      (device) =>
        device.zoneId === this.TEST_ZONE_ID &&
        device.roomId === this.TEST_ROOM_ID,
    );

    for (const device of devices) {
      const unitIds = this.normalizeUnitIds(device.ids);

      if (unitIds.length === 0) {
        continue;
      }

      try {
        const connKey = this.getConnKey(device.ip, device.port);
        const conn = await this.ensureConnection(device.ip, device.port);

        for (const unitId of unitIds) {
          for (const zone of [1, 2] as const) {
            const snapshot = await this.readSnapshot(
              conn.service,
              connKey,
              unitId,
              zone,
            );
            await this.handleSnapshot(
              device,
              unitIds,
              unitId,
              zone,
              snapshot,
              conn.service,
              connKey,
            );
          }
        }
      } catch (error) {
        console.error(
          `[MonitorPolarbearService] failed for device ${device.id} via ${device.ip}:${device.port}`,
          error,
        );
      }
    }
  }

  private async handleSnapshot(
    device: DeviceRow,
    siblingUnitIds: number[],
    unitId: number,
    zone: Zone,
    snapshot: Snapshot,
    service: PolarbearService,
    connKey: string,
  ): Promise<void> {
    for (const property of SYNC_PROPERTIES) {
      const value = snapshot[property];
      const stateKey = createDeviceStateKey(
        'panel',
        device.id,
        unitId,
        zone,
        property,
      );
      const previous = this.lastSeenState.get(stateKey);

      this.lastSeenState.set(stateKey, value);

      if (previous === undefined || sameNumericValue(previous, value)) {
        continue;
      }

      if (
        this.echoGuard?.consumeExpectedEcho(
          'panel',
          device.id,
          unitId,
          zone,
          property,
          value,
        )
      ) {
        continue;
      }

      await this.syncSiblingUnits(
        device,
        siblingUnitIds,
        unitId,
        zone,
        property,
        value,
        service,
        connKey,
      );

      if (!this.onStateChange) {
        continue;
      }

      await this.onStateChange({
        schema: 'aircotest.sync.v1',
        origin: 'panel',
        zoneId: device.zoneId,
        roomId: device.roomId,
        deviceId: device.id,
        unitId,
        zone,
        property,
        value,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async syncSiblingUnits(
    device: DeviceRow,
    siblingUnitIds: number[],
    sourceUnitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
    service: PolarbearService,
    connKey: string,
  ): Promise<void> {
    for (const targetUnitId of siblingUnitIds) {
      if (targetUnitId === sourceUnitId) {
        continue;
      }

      this.echoGuard?.expectEcho(
        'panel',
        device.id,
        targetUnitId,
        zone,
        property,
        value,
      );

      await this.enqueueWithGap(connKey, () =>
        this.writeProperty(service, targetUnitId, zone, property, value),
      );

      this.lastSeenState.set(
        createDeviceStateKey('panel', device.id, targetUnitId, zone, property),
        value,
      );
    }
  }

  private async readSnapshot(
    service: PolarbearService,
    connKey: string,
    unitId: number,
    zone: Zone,
  ): Promise<Snapshot> {
    return {
      setpoint: await this.enqueueWithGap(connKey, () =>
        service.getSetpoint(unitId, zone),
      ),
      virtualTemperature: await this.enqueueWithGap(connKey, () =>
        service.getVirtualTemperature(unitId, zone),
      ),
      fanSpeed: await this.enqueueWithGap(connKey, () =>
        service.getFanSpeed(unitId, zone),
      ),
      fanMode: await this.enqueueWithGap(connKey, () =>
        service.getFanMode(unitId, zone),
      ),
    };
  }

  private async writeProperty(
    service: PolarbearService,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): Promise<void> {
    switch (property) {
      case 'setpoint':
        await service.setSetpoint(unitId, zone, value);
        return;
      case 'virtualTemperature':
        await service.setVirtualTemperature(unitId, zone, value);
        return;
      case 'fanSpeed':
        await service.setFanSpeed(unitId, zone, value);
        return;
      case 'fanMode':
        await service.setFanMode(unitId, zone, value);
        return;
    }
  }
}
