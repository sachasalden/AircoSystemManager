import AdapterRegistry from '../adapters/AdapterRegistry';
import type { AircoAdapter } from '../adapters/IAircoAdapter';
import {
  AircopanelRepository,
  type AirconditionerDevice,
} from '../repositories/WallpanelRepository';
import type SyncEchoGuard from './SyncEchoGuard';
import {
  SYNC_PROPERTIES,
  createDeviceStateKey,
  sameNumericValue,
  type SyncMessage,
  type SyncProperty,
  type Zone,
} from './SyncTypes';

type AircoDeviceRow = AirconditionerDevice & { zoneId: string; roomId: string };
type Snapshot = Record<SyncProperty, number>;

export default class MonitorAircoService {
  private readonly TEST_ZONE_ID = '691ee9f917ddcc79daf9fe84';
  private readonly TEST_ROOM_ID = '2134af85-4377-2330-af2d-72143bec6574';

  // Tijdelijk hardcoded omdat airconditioners in DB geen IP of port hebben
  private readonly AIRCO_HOST = '192.168.55.10';
  private readonly AIRCO_PORT = 502;

  private timer: NodeJS.Timeout | null = null;
  private isStopped = false;
  private isStarted = false;
  private lastSeenState = new Map<string, number>();

  constructor(
    private repository: AircopanelRepository,
    private registry: AdapterRegistry,
    private onStateChange?: (message: SyncMessage) => Promise<void>,
    private echoGuard?: SyncEchoGuard,
    private pollIntervalMs = 5000,
  ) {}

  start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    this.isStopped = false;

    console.log('[MonitorAircoService] started');
    void this.runLoop();
  }

  async stop(): Promise<void> {
    this.isStopped = true;
    this.isStarted = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    console.log('[MonitorAircoService] stopped');
  }

  private async runLoop(): Promise<void> {
    if (this.isStopped) {
      this.timer = null;
      return;
    }

    try {
      await this.tick();
    } catch (error) {
      console.error('[MonitorAircoService] loop failed', error);
    }

    if (this.isStopped) {
      this.timer = null;
      return;
    }

    this.timer = setTimeout(() => {
      void this.runLoop();
    }, this.pollIntervalMs);
  }

  async applyRemoteChange(message: SyncMessage): Promise<void> {
    const devices = (await this.repository.getAircoDevices()).filter(
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
        await this.withAdapter(device, async (adapter, unitId) => {
          this.echoGuard?.expectEcho(
            'airco',
            device.id,
            unitId,
            message.zone,
            message.property,
            message.value,
          );

          await this.writeProperty(
            adapter,
            unitId,
            message.zone,
            message.property,
            message.value,
          );

          this.lastSeenState.set(
            createDeviceStateKey(
              'airco',
              device.id,
              unitId,
              message.zone,
              message.property,
            ),
            message.value,
          );
        });
      } catch (error) {
        console.error(
          `[MonitorAircoService] failed to apply ${message.property}=${message.value} to device ${device.id}`,
          error,
        );
      }
    }
  }

  private async tick(): Promise<void> {
    const devices = (await this.repository.getAircoDevices()).filter(
      (device) =>
        device.zoneId === this.TEST_ZONE_ID &&
        device.roomId === this.TEST_ROOM_ID,
    );

    for (const device of devices) {
      try {
        await this.withAdapter(device, async (adapter, unitId) => {
          for (const zone of [1, 2] as const) {
            const snapshot = await this.readSnapshot(adapter, unitId, zone);
            await this.handleSnapshot(device, unitId, zone, snapshot);
          }
        });
      } catch (error) {
        console.error(
          `[MonitorAircoService] failed to poll device ${device.id}`,
          error,
        );
      }
    }
  }

  private async handleSnapshot(
    device: AircoDeviceRow,
    unitId: number,
    zone: Zone,
    snapshot: Snapshot,
  ): Promise<void> {
    for (const property of SYNC_PROPERTIES) {
      const key = createDeviceStateKey(
        'airco',
        device.id,
        unitId,
        zone,
        property,
      );
      const value = snapshot[property];
      const previous = this.lastSeenState.get(key);

      this.lastSeenState.set(key, value);

      if (previous === undefined || sameNumericValue(previous, value)) {
        continue;
      }

      if (
        this.echoGuard?.consumeExpectedEcho(
          'airco',
          device.id,
          unitId,
          zone,
          property,
          value,
        )
      ) {
        continue;
      }

      if (!this.onStateChange) {
        continue;
      }

      await this.onStateChange({
        schema: 'aircotest.sync.v1',
        origin: 'airco',
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

  private resolveUnitId(device: AircoDeviceRow): number {
    const unitId = Number(device.data?.deviceTerminalId);

    if (!Number.isFinite(unitId)) {
      throw new Error(
        `[MonitorAircoService] device ${device.id} has invalid data.deviceTerminalId`,
      );
    }

    return unitId;
  }

  private async withAdapter<T>(
    device: AircoDeviceRow,
    fn: (adapter: AircoAdapter, unitId: number) => Promise<T>,
  ): Promise<T> {
    const type = device.data?.type;
    const model = device.deviceType;
    const unitId = this.resolveUnitId(device);

    if (!type) {
      throw new Error(
        `[MonitorAircoService] device ${device.id} missing data.type`,
      );
    }

    const adapter = this.registry.create(type, {
      host: this.AIRCO_HOST,
      port: this.AIRCO_PORT,
      type,
      model,
    });

    await adapter.connect();

    try {
      return await fn(adapter, unitId);
    } finally {
      await adapter.disconnect();
    }
  }

  private async readSnapshot(
    adapter: AircoAdapter,
    unitId: number,
    zone: Zone,
  ): Promise<Snapshot> {
    return {
      setpoint: await adapter.getSetpoint(unitId, zone),
      virtualTemperature: await adapter.getVirtualTemperature(unitId, zone),
      fanSpeed: await adapter.getFanSpeed(unitId, zone),
      fanMode: await adapter.getFanMode(unitId, zone),
    };
  }

  private async writeProperty(
    adapter: AircoAdapter,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): Promise<void> {
    switch (property) {
      case 'setpoint':
        await adapter.setSetpoint(unitId, zone, value);
        return;
      case 'virtualTemperature':
        await adapter.setVirtualTemperature(unitId, zone, value);
        return;
      case 'fanSpeed':
        await adapter.setFanSpeed(unitId, zone, value);
        return;
      case 'fanMode':
        await adapter.setFanMode(unitId, zone, value);
        return;
    }
  }
}
