import AdapterRegistry from '../adapters/AdapterRegistry';
import type { AircoAdapter, AircoConnection } from '../adapters/IAircoAdapter';
import SyncEchoGuard from './SyncEchoGuard';
import {
  AIRCO_TO_PANEL_PROPERTIES,
  createStateKey,
  sameNumericValue,
  type SyncMessage,
  type SyncProperty,
  type TopologyRoom,
  type Zone,
} from './SyncTypes';

type Snapshot = Record<SyncProperty, number>;

export default class AircoMonitor {
  private readonly lastState = new Map<string, number>();

  constructor(
    private registry: AdapterRegistry,
    private echoGuard: SyncEchoGuard,
    private onAircoChange: (
      message: Omit<
        SyncMessage,
        'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
      >,
    ) => Promise<void>,
  ) {}

  async pollRooms(rooms: TopologyRoom[]): Promise<void> {
    for (const room of rooms) {
      for (const airco of room.aircos) {
        const type = airco.data?.type;
        const model = airco.deviceType;
        const unitId = Number(airco.data?.deviceTerminalId);
        const host = airco.environmentDevice?.ip;
        const port = Number(airco.environmentDevice?.port);

        if (!type || !Number.isFinite(unitId) || !host || !Number.isFinite(port)) {
          console.warn('[AircoMonitor] skipped poll due to missing environment device', {
            roomId: room.roomId,
            aircoId: airco.id,
            environmentDeviceId: airco.data?.deviceId,
          });
          continue;
        }

        const adapter = this.registry.create(
          type,
          this.createConnection(airco, host, port, type, model),
        );

        try {
          await adapter.connect();

          for (const zone of [1, 2] as const) {
            const snapshot = await this.readSnapshot(adapter, unitId, zone);
            await this.handleSnapshot(room, airco.id, unitId, zone, snapshot);
          }
        } catch (error) {
          console.error(
            `[AircoMonitor] poll failed room=${room.roomName} airco=${airco.id}`,
            error,
          );
        } finally {
          try {
            await adapter.disconnect();
          } catch {}
        }
      }
    }
  }

  async applyPanelChangeLocally(
    rooms: TopologyRoom[],
    message: SyncMessage,
  ): Promise<void> {
    if (message.origin !== 'panel') {
      return;
    }

    if (
      message.property !== 'setpoint' &&
      message.property !== 'fanMode' &&
      message.property !== 'fanSpeed'
    ) {
      return;
    }

    const room = rooms.find(
      (r) => r.zoneId === message.zoneId && r.roomId === message.roomId,
    );

    if (!room) {
      return;
    }

    for (const airco of room.aircos) {
      const type = airco.data?.type;
      const model = airco.deviceType;
      const unitId = Number(airco.data?.deviceTerminalId);
      const host = airco.environmentDevice?.ip;
      const port = Number(airco.environmentDevice?.port);

      if (!type || !Number.isFinite(unitId) || !host || !Number.isFinite(port)) {
        console.warn(
          '[AircoMonitor] skipped panel->airco apply due to missing environment device',
          {
            roomId: room.roomId,
            aircoId: airco.id,
            environmentDeviceId: airco.data?.deviceId,
          },
        );
        continue;
      }

      const adapter = this.registry.create(
        type,
        this.createConnection(airco, host, port, type, model),
      );

      try {
        console.log('[AircoMonitor] applying panel change locally', {
          aircoId: airco.id,
          property: message.property,
          value: message.value,
          zone: message.zone,
        });

        await adapter.connect();
        await this.writeProperty(
          adapter,
          unitId,
          message.zone,
          message.property,
          message.value,
        );

        this.echoGuard.remember(
          airco.id,
          unitId,
          message.zone,
          message.property,
          message.value,
        );

        this.lastState.set(
          createStateKey(airco.id, unitId, message.zone, message.property),
          message.value,
        );
      } catch (error) {
        console.error(
          `[AircoMonitor] applyPanelChangeLocally failed airco=${airco.id}`,
          error,
        );
      } finally {
        try {
          await adapter.disconnect();
        } catch {}
      }
    }
  }

  private async handleSnapshot(
    room: TopologyRoom,
    aircoId: string,
    unitId: number,
    zone: Zone,
    snapshot: Snapshot,
  ): Promise<void> {
    for (const property of Object.keys(snapshot) as SyncProperty[]) {
      if (!AIRCO_TO_PANEL_PROPERTIES.includes(property)) {
        continue;
      }

      const value = snapshot[property];
      const key = createStateKey(aircoId, unitId, zone, property);
      const previous = this.lastState.get(key);

      this.lastState.set(key, value);

      if (previous === undefined) {
        continue;
      }

      if (sameNumericValue(previous, value)) {
        continue;
      }

      if (
        this.echoGuard.consumeIfExpected(aircoId, unitId, zone, property, value)
      ) {
        continue;
      }

      console.log('[AircoMonitor] local airco change detected', {
        roomId: room.roomId,
        aircoId,
        unitId,
        zone,
        property,
        value,
        previous,
      });

      await this.onAircoChange({
        origin: 'airco',
        zoneId: room.zoneId,
        roomId: room.roomId,
        deviceId: aircoId,
        unitId,
        zone,
        property,
        value,
      });
    }
  }

  private createConnection(
    airco: TopologyRoom['aircos'][number],
    host: string,
    port: number,
    type: string,
    model?: string,
  ): AircoConnection {
    return {
      ...airco.data,
      host,
      port,
      type,
      model,
      bidirectional: airco.environmentDevice?.bidirectional,
    };
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
