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
type AircoCommandProperty = 'setpoint' | 'fanSpeed' | 'fanMode';
type AircoSnapshotContext = {
  zoneId: string;
  roomId: string;
  aircoId: string;
  unitId: number;
  zone: Zone;
  timestamp: string;
};

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
    private onSnapshot?: (
      context: AircoSnapshotContext,
      snapshot: Snapshot,
    ) => void | Promise<void>,
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
            await this.onSnapshot?.(
              {
                zoneId: room.zoneId,
                roomId: room.roomId,
                aircoId: airco.id,
                unitId,
                zone,
                timestamp: new Date().toISOString(),
              },
              snapshot,
            );
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

        if (message.property === 'setpoint') {
          airco.setTemperature = message.value;
        }

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

  async applyCommandLocally(
    rooms: TopologyRoom[],
    command: {
      zoneId: string;
      roomId: string;
      aircoId: string;
      zone: Zone;
      property: AircoCommandProperty;
      value: number;
    },
  ): Promise<{ unitId: number }> {
    const room = rooms.find(
      (r) => r.zoneId === command.zoneId && r.roomId === command.roomId,
    );

    if (!room) {
      throw new Error('Room not found');
    }

    const airco = room.aircos.find((item) => item.id === command.aircoId);

    if (!airco) {
      throw new Error('Airco not found in room');
    }

    const type = airco.data?.type;
    const model = airco.deviceType;
    const unitId = Number(airco.data?.deviceTerminalId);
    const host = airco.environmentDevice?.ip;
    const port = Number(airco.environmentDevice?.port);

    if (!type || !Number.isFinite(unitId) || !host || !Number.isFinite(port)) {
      throw new Error('Airco missing valid environment device connection');
    }

    const adapter = this.registry.create(
      type,
      this.createConnection(airco, host, port, type, model),
    );

    await adapter.connect();

    try {
      await this.writeProperty(
        adapter,
        unitId,
        command.zone,
        command.property,
        command.value,
      );

      this.echoGuard.remember(
        airco.id,
        unitId,
        command.zone,
        command.property,
        command.value,
      );

      if (command.property === 'setpoint') {
        airco.setTemperature = command.value;
      }

      this.lastState.set(
        createStateKey(airco.id, unitId, command.zone, command.property),
        command.value,
      );

      return { unitId };
    } finally {
      await adapter.disconnect();
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
      if (property === 'setpoint') {
        continue;
      }

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
      setTemperature: airco.setTemperature,
      currentTemperature: airco.currentTemperature,
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
