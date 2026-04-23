import WallpanelPoller, { type FullSnapshot } from './WallpanelPoller';
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
  poller: WallpanelPoller;
  unitIds: number[];
};

type SnapshotContext = {
  zoneId: string;
  roomId: string;
  panelId: string;
  unitId: number;
  zone: Zone;
  timestamp: string;
};

export default class PolarbearMonitor {
  private connections = new Map<ConnectionKey, ConnectionState>();
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
      context: SnapshotContext,
      snapshot: Snapshot,
    ) => void | Promise<void>,
    private modbusTimeoutMs = 10000,
    private requestGapMs = 30,
  ) {}

  async stop(): Promise<void> {
    for (const conn of this.connections.values()) {
      try {
        await conn.poller.stop();
      } catch {}
    }

    this.connections.clear();
  }

  async pollRooms(rooms: TopologyRoom[]): Promise<void> {
    for (const room of rooms) {
      for (const panel of room.panels) {
        if (!panel.ids.length) {
          continue;
        }

        try {
          const conn = await this.ensureConnection(
            panel.ip,
            panel.port,
            panel.ids,
          );

          for (const unitId of panel.ids) {
            const snapshot = await conn.poller.getSnapshot(unitId);

            for (const zone of [1, 2] as const) {
              await this.handleSnapshot(
                room,
                panel.id,
                unitId,
                zone,
                this.toSyncSnapshot(snapshot, zone),
                snapshot.timestamp,
              );

              await this.detectFlags(room, panel.id, unitId, zone, conn.poller);
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
      if (!panel.ids.length) {
        continue;
      }

      try {
        const conn = await this.ensureConnection(
          panel.ip,
          panel.port,
          panel.ids,
        );

        for (const unitId of panel.ids) {
          console.log('[PolarbearMonitor] applying airco change locally', {
            panelId: panel.id,
            unitId,
            property: message.property,
            value: message.value,
            zone: message.zone,
          });

          await this.writeProperty(
            conn.poller,
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
    poller: WallpanelPoller,
  ): Promise<void> {
    const flags = await poller.getFlags(unitId);
    const lastFlagKey = `${panelId}:${unitId}:flags:${zone}`;
    const prevFlags = this.lastFlags.get(lastFlagKey);
    this.lastFlags.set(lastFlagKey, flags);

    if (prevFlags === undefined) {
      return;
    }

    const setpointBit = zone === 1 ? 0x0001 : 0x0100;
    const fanModeBit = zone === 1 ? 0x0002 : 0x0200;

    if ((flags & setpointBit) !== 0) {
      const value = await poller.getPendingSetpoint(unitId, zone);

      await poller.clearFlag(unitId, zone, 'setpoint', flags);

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
      const value = await poller.getPendingFanMode(unitId, zone);

      await poller.clearFlag(unitId, zone, 'fanMode', flags);

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
      if (!panel.ids.length) {
        continue;
      }

      try {
        const conn = await this.ensureConnection(
          panel.ip,
          panel.port,
          panel.ids,
        );

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
            conn.poller,
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
    timestamp: string,
  ): Promise<void> {
    await this.onSnapshot(
      {
        zoneId: room.zoneId,
        roomId: room.roomId,
        panelId,
        unitId,
        zone,
        timestamp,
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

  private toSyncSnapshot(snapshot: FullSnapshot, zone: Zone): Snapshot {
    const zoneSnapshot = zone === 1 ? snapshot.zone1 : snapshot.zone2;

    return {
      setpoint: zoneSnapshot.setpoint,
      virtualTemperature: zoneSnapshot.virtualTemp,
      fanSpeed: zoneSnapshot.fanSpeed,
      fanMode: zoneSnapshot.fanMode,
    };
  }

  private async writeProperty(
    poller: WallpanelPoller,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): Promise<void> {
    switch (property) {
      case 'setpoint':
        await poller.setSetpoint(unitId, zone, value);
        return;
      case 'virtualTemperature':
        await poller.setVirtualTemp(unitId, zone, value);
        return;
      case 'fanSpeed':
        await poller.setFanSpeed(unitId, zone, value);
        return;
      case 'fanMode':
        await poller.setFanMode(unitId, zone, value);
        return;
    }
  }

  private getConnKey(ip: string, port: number): string {
    return `${ip}:${port}`;
  }

  private async ensureConnection(
    ip: string,
    port: number,
    unitIds: number[],
  ): Promise<ConnectionState> {
    const key = this.getConnKey(ip, port);
    const nextUnitIds = this.normalizeUnitIds(unitIds);

    if (!nextUnitIds.length) {
      throw new Error(`Geen geldige unitIds voor wallpanel ${key}.`);
    }

    const existing = this.connections.get(key);

    if (existing) {
      const mergedUnitIds = this.mergeUnitIds(existing.unitIds, nextUnitIds);

      if (mergedUnitIds.length === existing.unitIds.length) {
        return existing;
      }

      await existing.poller.stop();
      return this.createConnection(key, ip, port, mergedUnitIds);
    }

    return this.createConnection(key, ip, port, nextUnitIds);
  }

  private createConnection(
    key: string,
    host: string,
    port: number,
    unitIds: number[],
  ): ConnectionState {
    const conn = {
      poller: new WallpanelPoller({
        host,
        port,
        unitIds,
        minInterMessageGapMs: this.requestGapMs,
        timeoutMs: this.modbusTimeoutMs,
      }),
      unitIds,
    };

    this.connections.set(key, conn);

    return conn;
  }

  private normalizeUnitIds(unitIds: number[]): number[] {
    return [...new Set(unitIds)]
      .filter((unitId) => Number.isFinite(unitId))
      .sort((a, b) => a - b);
  }

  private mergeUnitIds(current: number[], next: number[]): number[] {
    return this.normalizeUnitIds([...current, ...next]);
  }
}
