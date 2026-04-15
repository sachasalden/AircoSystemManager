import ModbusClient from '../clients/ModbusClient';
import PolarbearService from './PolarbearService';
import SyncEchoGuard from './SyncEchoGuard';
import {
  PANEL_TO_AIRCO_PROPERTIES,
  AIRCO_TO_PANEL_PROPERTIES,
  createStateKey,
  sameNumericValue,
  type SyncMessage,
  type SyncProperty,
  type TopologyRoom,
  type Zone,
} from './SyncTypes';

type Snapshot = Record<SyncProperty, number>;
type ConnectionKey = string;

type ConnectionState = {
  client: ModbusClient;
  service: PolarbearService;
  isConnected: boolean;
};

export default class PolarbearMonitor {
  private connections = new Map<ConnectionKey, ConnectionState>();
  private connQueues = new Map<ConnectionKey, Promise<void>>();
  private lastState = new Map<string, number>();
  private lastFlags = new Map<string, number>();

  constructor(
    private echoGuard: SyncEchoGuard,
    private onPanelChange: (
      message: Omit<
        SyncMessage,
        'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
      >,
    ) => Promise<void>,
    private onSnapshot: (
      context: {
        zoneId: string;
        roomId: string;
        panelId: string;
        unitId: number;
        zone: Zone;
      },
      snapshot: Snapshot,
    ) => void | Promise<void>,
    private modbusTimeoutMs = 10000,
    private requestGapMs = 30,
  ) {}

  async stop(): Promise<void> {
    for (const conn of this.connections.values()) {
      try {
        await conn.client.disconnect();
      } catch {}
    }

    this.connections.clear();
    this.connQueues.clear();
  }

  async pollRooms(rooms: TopologyRoom[]): Promise<void> {
    for (const room of rooms) {
      for (const panel of room.panels) {
        if (!panel.ids.length) {
          continue;
        }

        try {
          const conn = await this.ensureConnection(panel.ip, panel.port);
          const connKey = this.getConnKey(panel.ip, panel.port);

          for (const unitId of panel.ids) {
            for (const zone of [1, 2] as const) {
              const snapshot = await this.readSnapshot(
                conn.service,
                connKey,
                unitId,
                zone,
              );

              await this.handleSnapshot(room, panel.id, unitId, zone, snapshot);

              await this.detectFlags(
                room,
                panel.id,
                unitId,
                zone,
                conn.service,
                connKey,
              );
            }
          }
        } catch (error) {
          console.error(
            `[PolarbearMonitor] poll failed room=${room.roomName} panel=${panel.id}`,
            error,
          );
        }
      }
    }
  }

  async applyAircoChangeLocally(
    rooms: TopologyRoom[],
    message: SyncMessage,
  ): Promise<void> {
    if (message.origin !== 'airco') {
      return;
    }

    if (!AIRCO_TO_PANEL_PROPERTIES.includes(message.property)) {
      return;
    }

    const room = rooms.find(
      (r) => r.zoneId === message.zoneId && r.roomId === message.roomId,
    );

    if (!room) {
      return;
    }

    for (const panel of room.panels) {
      try {
        const conn = await this.ensureConnection(panel.ip, panel.port);
        const connKey = this.getConnKey(panel.ip, panel.port);

        await this.enqueueWithGap(connKey, async () => {
          for (const unitId of panel.ids) {
            console.log('[PolarbearMonitor] applying airco change locally', {
              panelId: panel.id,
              unitId,
              property: message.property,
              value: message.value,
              zone: message.zone,
            });

            await this.writeProperty(
              conn.service,
              unitId,
              message.zone,
              message.property,
              message.value,
            );

            this.echoGuard.remember(
              panel.id,
              unitId,
              message.zone,
              message.property,
              message.value,
            );

            this.lastState.set(
              createStateKey(panel.id, unitId, message.zone, message.property),
              message.value,
            );
          }
        });
      } catch (error) {
        console.error(
          `[PolarbearMonitor] applyAircoChangeLocally failed panel=${panel.id}`,
          error,
        );
      }
    }
  }

  private async detectFlags(
    room: TopologyRoom,
    panelId: string,
    unitId: number,
    zone: Zone,
    service: PolarbearService,
    connKey: string,
  ): Promise<void> {
    const flags = await this.enqueueWithGap(connKey, () =>
      service.getFlags(unitId),
    );
    const lastFlagKey = `${panelId}:${unitId}:flags:${zone}`;
    const prevFlags = this.lastFlags.get(lastFlagKey);
    this.lastFlags.set(lastFlagKey, flags);

    if (prevFlags === undefined) {
      return;
    }

    const setpointBit = zone === 1 ? 0x0001 : 0x0100;
    const fanModeBit = zone === 1 ? 0x0002 : 0x0200;

    if ((flags & setpointBit) !== 0) {
      const value = await this.enqueueWithGap(connKey, () =>
        service.getPendingSetpoint(unitId, zone),
      );

      await this.enqueueWithGap(connKey, () =>
        service.clearFlag(unitId, zone, 'setpoint', flags),
      );

      await this.handleLocalPanelChange(
        room,
        panelId,
        unitId,
        zone,
        'setpoint',
        value,
      );
    }

    if ((flags & fanModeBit) !== 0) {
      const value = await this.enqueueWithGap(connKey, () =>
        service.getPendingFanMode(unitId, zone),
      );

      await this.enqueueWithGap(connKey, () =>
        service.clearFlag(unitId, zone, 'fanMode', flags),
      );

      await this.handleLocalPanelChange(
        room,
        panelId,
        unitId,
        zone,
        'fanMode',
        value,
      );
    }
  }

  private async handleLocalPanelChange(
    room: TopologyRoom,
    panelId: string,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): Promise<void> {
    if (!PANEL_TO_AIRCO_PROPERTIES.includes(property)) {
      return;
    }

    if (
      this.echoGuard.consumeIfExpected(panelId, unitId, zone, property, value)
    ) {
      return;
    }

    this.lastState.set(createStateKey(panelId, unitId, zone, property), value);

    // Zorg dat andere panel-units in dezelfde room ook direct gelijk lopen.
    await this.syncSiblingPanels(room, panelId, unitId, zone, property, value);

    console.log('[PolarbearMonitor] local panel change detected', {
      roomId: room.roomId,
      panelId,
      unitId,
      zone,
      property,
      value,
    });

    await this.onPanelChange({
      origin: 'panel',
      zoneId: room.zoneId,
      roomId: room.roomId,
      deviceId: panelId,
      unitId,
      zone,
      property,
      value,
    });
  }

  private async syncSiblingPanels(
    room: TopologyRoom,
    sourcePanelId: string,
    sourceUnitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): Promise<void> {
    if (
      property !== 'setpoint' &&
      property !== 'fanMode' &&
      property !== 'fanSpeed'
    ) {
      return;
    }

    for (const panel of room.panels) {
      try {
        const conn = await this.ensureConnection(panel.ip, panel.port);
        const connKey = this.getConnKey(panel.ip, panel.port);

        await this.enqueueWithGap(connKey, async () => {
          for (const targetUnitId of panel.ids) {
            if (panel.id === sourcePanelId && targetUnitId === sourceUnitId) {
              continue;
            }

            console.log('[PolarbearMonitor] syncing sibling panel', {
              sourcePanelId,
              sourceUnitId,
              targetPanelId: panel.id,
              targetUnitId,
              zone,
              property,
              value,
            });

            await this.writeProperty(
              conn.service,
              targetUnitId,
              zone,
              property,
              value,
            );

            this.echoGuard.remember(
              panel.id,
              targetUnitId,
              zone,
              property,
              value,
            );

            this.lastState.set(
              createStateKey(panel.id, targetUnitId, zone, property),
              value,
            );
          }
        });
      } catch (error) {
        console.error(
          `[PolarbearMonitor] syncSiblingPanels failed panel=${panel.id}`,
          error,
        );
      }
    }
  }

  private async handleSnapshot(
    room: TopologyRoom,
    panelId: string,
    unitId: number,
    zone: Zone,
    snapshot: Snapshot,
  ): Promise<void> {
    await this.onSnapshot(
      {
        zoneId: room.zoneId,
        roomId: room.roomId,
        panelId,
        unitId,
        zone,
      },
      snapshot,
    );

    for (const property of Object.keys(snapshot) as SyncProperty[]) {
      const value = snapshot[property];
      const key = createStateKey(panelId, unitId, zone, property);
      const previous = this.lastState.get(key);

      this.lastState.set(key, value);

      if (previous === undefined) {
        continue;
      }

      if (sameNumericValue(previous, value)) {
        continue;
      }

      if (
        this.echoGuard.consumeIfExpected(panelId, unitId, zone, property, value)
      ) {
        continue;
      }

      if (property === 'virtualTemperature') {
        console.log('[PolarbearMonitor] panel virtualTemperature changed', {
          roomId: room.roomId,
          panelId,
          unitId,
          zone,
          value,
          previous,
        });

        await this.onPanelChange({
          origin: 'panel',
          zoneId: room.zoneId,
          roomId: room.roomId,
          deviceId: panelId,
          unitId,
          zone,
          property,
          value,
        });
      }
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

  private getConnKey(ip: string, port: number): string {
    return `${ip}:${port}`;
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

  private enqueue<T>(connKey: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.connQueues.get(connKey) ?? Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(fn)
      .finally(() => undefined);

    this.connQueues.set(
      connKey,
      next.then(() => undefined).catch(() => undefined),
    );

    return next;
  }

  private enqueueWithGap<T>(connKey: string, fn: () => Promise<T>): Promise<T> {
    return this.enqueue(connKey, async () => {
      const result = await fn();

      if (this.requestGapMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.requestGapMs));
      }

      return result;
    });
  }
}
