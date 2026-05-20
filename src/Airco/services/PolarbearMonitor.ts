import WallpanelPoller, { type FullSnapshot } from './WallpanelPoller';
import SyncEchoGuard from './SyncEchoGuard';
import type { FlagType } from './PolarbearService';
import {
  AIRCO_TO_PANEL_PROPERTIES,
  PANEL_TO_AIRCO_PROPERTIES,
  createStateKey,
  sameNumericValue,
  type SyncMessage,
  type SyncProperty,
  type TopologyRoom,
  type Zone,
} from './SyncTypes';

type Snapshot = Record<SyncProperty, number>;
type ConnectionKey = string;
type CandidateType = Extract<SyncProperty, 'setpoint' | 'fanMode'>;
type PanelWritableProperty = Extract<
  SyncProperty,
  'setpoint' | 'virtualTemperature' | 'fanSpeed' | 'fanMode'
>;

type Panel = TopologyRoom['panels'][number];

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

type SetpointCache = {
  value: number;
  signature: string;
  changedAt: number;
};

type SuppressedWrite = {
  signature: string;
  until: number;
};

type CandidateBase = {
  room: TopologyRoom;
  sourcePanelId: string;
  sourceUnitId: number;
  zone: Zone;
  signature: string;
  changedAt: number;
  createdAt: number;
};

type Candidate =
  | (CandidateBase & {
      type: 'setpoint';
      value: number;
    })
  | (CandidateBase & {
      type: 'fanMode';
      fanMode: number;
      fanSpeed: number;
    });

const ZONES = [1, 2] as const;

const FLAG_BITS: Record<FlagType, Record<Zone, number>> = {
  setpoint: { 1: 0, 2: 8 },
  fanMode: { 1: 1, 2: 9 },
};

function hasFlag(flags: number, zone: Zone, type: FlagType): boolean {
  return (flags & (1 << FLAG_BITS[type][zone])) !== 0;
}

function clearFlag(flags: number, zone: Zone, type: FlagType): number {
  return flags & ~(1 << FLAG_BITS[type][zone]);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeFanMode(value: number): number {
  return Number(value) === 0 ? 0 : 1;
}

function setpointSignature(value: number): string {
  return `setpoint:${round1(value)}`;
}

function fanSignature(fanMode: number, fanSpeed: number): string {
  return `fanMode:${normalizeFanMode(fanMode)}:fanSpeed:${fanSpeed}`;
}

function isTimeoutError(error: unknown): boolean {
  const err = error as { name?: string; message?: string };

  return (
    err?.name === 'TransactionTimedOutError' ||
    String(err?.message ?? '').toLowerCase().includes('timed out')
  );
}

function isCandidateProperty(
  property: SyncProperty,
): property is CandidateType {
  return property === 'setpoint' || property === 'fanMode';
}

function isPanelWritableProperty(
  property: SyncProperty,
): property is PanelWritableProperty {
  return (
    property === 'setpoint' ||
    property === 'virtualTemperature' ||
    property === 'fanSpeed' ||
    property === 'fanMode'
  );
}

export default class PolarbearMonitor {
  private connections = new Map<ConnectionKey, ConnectionState>();
  private lastState = new Map<string, number>();
  private candidates = new Map<string, Candidate>();
  private setpointCache = new Map<string, SetpointCache>();
  private suppressedWrites = new Map<string, SuppressedWrite>();
  private startupFlagsCleared = new Set<string>();

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
    private debounceMs = Number(process.env.PANEL_DEBOUNCE_MS || 5000),
    private suppressOwnWriteMs = Number(
      process.env.PANEL_SUPPRESS_OWN_WRITE_MS || 12000,
    ),
  ) {}

  async stop(): Promise<void> {
    await Promise.allSettled(
      [...this.connections.values()].map((conn) => conn.poller.stop()),
    );

    this.connections.clear();
  }

  async pollRooms(rooms: TopologyRoom[]): Promise<void> {
    for (const room of rooms) {
      for (const panel of room.panels) {
        await this.pollPanel(room, panel);
      }
    }

    await this.processCandidates();
  }

  async applyAircoChangeLocally(
    rooms: TopologyRoom[],
    message: SyncMessage,
  ): Promise<void> {
    if (
      message.origin !== 'airco' ||
      !AIRCO_TO_PANEL_PROPERTIES.includes(message.property)
    ) {
      return;
    }

    const room = rooms.find(
      (candidate) =>
        candidate.zoneId === message.zoneId &&
        candidate.roomId === message.roomId,
    );

    if (!room) {
      return;
    }

    for (const panel of room.panels) {
      await this.applyAircoChangeToPanel(panel, message);
    }
  }

  private async pollPanel(room: TopologyRoom, panel: Panel): Promise<void> {
    if (!panel.ids.length) {
      return;
    }

    try {
      const conn = await this.ensurePanelConnection(panel);

      for (const unitId of panel.ids) {
        const snapshot = await conn.poller.getSnapshot(unitId);

        await this.clearStartupFlags(panel.id, unitId, conn.poller);

        for (const zone of ZONES) {
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

  private async applyAircoChangeToPanel(
    panel: Panel,
    message: SyncMessage,
  ): Promise<void> {
    if (!panel.ids.length || !isPanelWritableProperty(message.property)) {
      return;
    }

    try {
      const conn = await this.ensurePanelConnection(panel);

      for (const unitId of panel.ids) {
        const value = this.normalizeSyncValue(message.property, message.value);

        await this.suppressCandidateWriteIfNeeded(
          conn.poller,
          panel.id,
          unitId,
          message.zone,
          message.property,
          value,
        );

        await this.safeWrite(() =>
          this.writeProperty(
            conn.poller,
            unitId,
            message.zone,
            message.property,
            value,
          ),
        );

        this.rememberLocalWrite(
          panel.id,
          unitId,
          message.zone,
          message.property,
          value,
        );
      }
    } catch (error) {
      console.error(
        `[PolarbearMonitor] applyAircoChangeLocally failed panel=${panel.id}`,
        error,
      );
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

    if (hasFlag(flags, zone, 'setpoint')) {
      await this.consumeSetpointFlag(
        room,
        panelId,
        unitId,
        zone,
        flags,
        poller,
      );
    }

    if (hasFlag(flags, zone, 'fanMode')) {
      await this.consumeFanFlag(room, panelId, unitId, zone, flags, poller);
    }
  }

  private async consumeSetpointFlag(
    room: TopologyRoom,
    panelId: string,
    unitId: number,
    zone: Zone,
    flags: number,
    poller: WallpanelPoller,
  ): Promise<void> {
    const cache = await this.updateSetpointCache(panelId, unitId, zone, poller);

    await this.safeClearFlag(poller, unitId, zone, 'setpoint', flags);

    if (
      this.shouldIgnoreOwnWrite(
        panelId,
        unitId,
        zone,
        'setpoint',
        cache.signature,
      )
    ) {
      return;
    }

    this.setCandidate({
      type: 'setpoint',
      room,
      sourcePanelId: panelId,
      sourceUnitId: unitId,
      zone,
      value: cache.value,
      signature: cache.signature,
      changedAt: cache.changedAt,
      createdAt: Date.now(),
    });
  }

  private async consumeFanFlag(
    room: TopologyRoom,
    panelId: string,
    unitId: number,
    zone: Zone,
    flags: number,
    poller: WallpanelPoller,
  ): Promise<void> {
    try {
      const fanMode = normalizeFanMode(
        await poller.getPendingFanMode(unitId, zone),
      );
      const fanSpeed = await poller.getFanSpeed(unitId, zone);
      const signature = fanSignature(fanMode, fanSpeed);

      await this.safeClearFlag(poller, unitId, zone, 'fanMode', flags);

      if (this.shouldIgnoreOwnWrite(panelId, unitId, zone, 'fanMode', signature)) {
        return;
      }

      this.setCandidate({
        type: 'fanMode',
        room,
        sourcePanelId: panelId,
        sourceUnitId: unitId,
        zone,
        fanMode,
        fanSpeed,
        signature,
        changedAt: Date.now(),
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error(
        `[PolarbearMonitor] fan flag handling failed panel=${panelId} unit=${unitId}`,
        error,
      );
    }
  }

  private async updateSetpointCache(
    panelId: string,
    unitId: number,
    zone: Zone,
    poller: WallpanelPoller,
  ): Promise<SetpointCache> {
    const key = this.sourceKey(panelId, unitId, zone, 'setpoint');
    const previous = this.setpointCache.get(key);

    try {
      const value = round1(await poller.getPendingSetpoint(unitId, zone));
      const signature = setpointSignature(value);

      if (previous?.signature === signature) {
        return previous;
      }

      const next = {
        value,
        signature,
        changedAt: Date.now(),
      };

      this.setpointCache.set(key, next);
      return next;
    } catch (error) {
      console.error(
        `[PolarbearMonitor] pending setpoint read failed panel=${panelId} unit=${unitId}`,
        error,
      );

      return previous ?? {
        value: 0,
        signature: 'setpoint:0',
        changedAt: 0,
      };
    }
  }

  private setCandidate(candidate: Candidate): void {
    const key = this.candidateKey(candidate.room, candidate.zone, candidate.type);
    const existing = this.candidates.get(key);

    if (
      candidate.type === 'setpoint' &&
      existing?.type === 'setpoint' &&
      existing.sourceUnitId !== candidate.sourceUnitId &&
      candidate.changedAt < existing.changedAt
    ) {
      return;
    }

    this.candidates.set(key, candidate);
  }

  private async processCandidates(): Promise<void> {
    const now = Date.now();

    for (const [key, candidate] of this.candidates) {
      if (now - candidate.createdAt < this.debounceMs) {
        continue;
      }

      await this.syncCandidate(candidate);
      this.candidates.delete(key);
    }
  }

  private async syncCandidate(candidate: Candidate): Promise<void> {
    if (candidate.type === 'setpoint') {
      await this.syncSiblingPanels(
        candidate.room,
        candidate.sourcePanelId,
        candidate.sourceUnitId,
        candidate.zone,
        'setpoint',
        candidate.value,
        candidate.signature,
      );

      await this.publishCandidate(candidate, 'setpoint', candidate.value);
      return;
    }

    await this.syncSiblingPanels(
      candidate.room,
      candidate.sourcePanelId,
      candidate.sourceUnitId,
      candidate.zone,
      'fanMode',
      candidate.fanMode,
      candidate.signature,
    );

    await this.syncSiblingPanels(
      candidate.room,
      candidate.sourcePanelId,
      candidate.sourceUnitId,
      candidate.zone,
      'fanSpeed',
      candidate.fanSpeed,
      candidate.signature,
    );

    await this.publishCandidate(candidate, 'fanMode', candidate.fanMode);
  }

  private async publishCandidate(
    candidate: Candidate,
    property: CandidateType,
    value: number,
  ): Promise<void> {
    if (!PANEL_TO_AIRCO_PROPERTIES.includes(property)) {
      return;
    }

    await this.onPanelChange({
      origin: 'panel',
      zoneId: candidate.room.zoneId,
      roomId: candidate.room.roomId,
      deviceId: candidate.sourcePanelId,
      unitId: candidate.sourceUnitId,
      zone: candidate.zone,
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
    signature?: string,
  ): Promise<void> {
    if (!isPanelWritableProperty(property) || property === 'virtualTemperature') {
      return;
    }

    for (const panel of room.panels) {
      if (!panel.ids.length) {
        continue;
      }

      try {
        const conn = await this.ensurePanelConnection(panel);

        for (const unitId of panel.ids) {
          if (panel.id === sourcePanelId && unitId === sourceUnitId) {
            continue;
          }

          const normalizedValue = this.normalizeSyncValue(property, value);

          if (signature && isCandidateProperty(property)) {
            this.suppressOwnWrite(panel.id, unitId, zone, property, signature);
          }

          await this.safeWrite(() =>
            this.writeProperty(
              conn.poller,
              unitId,
              zone,
              property,
              normalizedValue,
            ),
          );

          this.rememberLocalWrite(panel.id, unitId, zone, property, normalizedValue);
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

      if (
        previous === undefined ||
        sameNumericValue(previous, value) ||
        this.echoGuard.consumeIfExpected(panelId, unitId, zone, property, value)
      ) {
        continue;
      }

      if (property === 'virtualTemperature') {
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
      fanMode: normalizeFanMode(zoneSnapshot.fanMode),
    };
  }

  private async suppressCandidateWriteIfNeeded(
    poller: WallpanelPoller,
    panelId: string,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): Promise<void> {
    if (!isCandidateProperty(property)) {
      return;
    }

    const signature = this.propertySignature(
      property,
      value,
      property === 'fanMode' ? await poller.getFanSpeed(unitId, zone) : undefined,
    );

    this.suppressOwnWrite(panelId, unitId, zone, property, signature);
  }

  private rememberLocalWrite(
    panelId: string,
    unitId: number,
    zone: Zone,
    property: SyncProperty,
    value: number,
  ): void {
    this.echoGuard.remember(panelId, unitId, zone, property, value);
    this.lastState.set(createStateKey(panelId, unitId, zone, property), value);
  }

  private async writeProperty(
    poller: WallpanelPoller,
    unitId: number,
    zone: Zone,
    property: PanelWritableProperty,
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

  private normalizeSyncValue(property: SyncProperty, value: number): number {
    return property === 'fanMode' ? normalizeFanMode(value) : value;
  }

  private async clearStartupFlags(
    panelId: string,
    unitId: number,
    poller: WallpanelPoller,
  ): Promise<void> {
    const key = `${panelId}:${unitId}`;

    if (this.startupFlagsCleared.has(key)) {
      return;
    }

    try {
      let flags = await poller.getFlags(unitId);

      for (const zone of ZONES) {
        for (const type of ['setpoint', 'fanMode'] as const) {
          if (!hasFlag(flags, zone, type)) {
            continue;
          }

          await this.safeClearFlag(poller, unitId, zone, type, flags);
          flags = clearFlag(flags, zone, type);
        }
      }
    } catch (error) {
      console.error(
        `[PolarbearMonitor] startup flag clear failed panel=${panelId} unit=${unitId}`,
        error,
      );
    } finally {
      this.startupFlagsCleared.add(key);
    }
  }

  private async safeClearFlag(
    poller: WallpanelPoller,
    unitId: number,
    zone: Zone,
    type: FlagType,
    flags: number,
  ): Promise<void> {
    try {
      await poller.clearFlag(unitId, zone, type, flags);
    } catch (error) {
      if (!isTimeoutError(error)) {
        console.error(
          `[PolarbearMonitor] flag clear error unit=${unitId} zone=${zone} type=${type}`,
          error,
        );
      }
    }
  }

  private async safeWrite(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      if (isTimeoutError(error)) {
        console.warn('[PolarbearMonitor] write timeout, mogelijk aangekomen');
        return;
      }

      throw error;
    }
  }

  private candidateKey(
    room: TopologyRoom,
    zone: Zone,
    type: CandidateType,
  ): string {
    return `${room.zoneId}:${room.roomId}:${zone}:${type}`;
  }

  private sourceKey(
    panelId: string,
    unitId: number,
    zone: Zone,
    type: CandidateType,
  ): string {
    return `${panelId}:${unitId}:${zone}:${type}`;
  }

  private propertySignature(
    property: CandidateType,
    value: number,
    fanSpeed?: number,
  ): string {
    return property === 'setpoint'
      ? setpointSignature(value)
      : fanSignature(value, fanSpeed ?? 0);
  }

  private suppressOwnWrite(
    panelId: string,
    unitId: number,
    zone: Zone,
    type: CandidateType,
    signature: string,
  ): void {
    this.suppressedWrites.set(this.sourceKey(panelId, unitId, zone, type), {
      signature,
      until: Date.now() + this.suppressOwnWriteMs,
    });
  }

  private shouldIgnoreOwnWrite(
    panelId: string,
    unitId: number,
    zone: Zone,
    type: CandidateType,
    signature: string,
  ): boolean {
    const key = this.sourceKey(panelId, unitId, zone, type);
    const suppressed = this.suppressedWrites.get(key);

    if (!suppressed) {
      return false;
    }

    if (Date.now() > suppressed.until) {
      this.suppressedWrites.delete(key);
      return false;
    }

    if (suppressed.signature !== signature) {
      return false;
    }

    this.suppressedWrites.delete(key);
    return true;
  }

  private ensurePanelConnection(panel: Panel): Promise<ConnectionState> {
    return this.ensureConnection(panel.ip, panel.port, panel.ids);
  }

  private async ensureConnection(
    ip: string,
    port: number,
    unitIds: number[],
  ): Promise<ConnectionState> {
    const key = `${ip}:${port}`;
    const nextUnitIds = this.normalizeUnitIds(unitIds);

    if (!nextUnitIds.length) {
      throw new Error(`Geen geldige unitIds voor wallpanel ${key}.`);
    }

    const existing = this.connections.get(key);

    if (!existing) {
      return this.createConnection(key, ip, port, nextUnitIds);
    }

    const mergedUnitIds = this.normalizeUnitIds([
      ...existing.unitIds,
      ...nextUnitIds,
    ]);

    if (mergedUnitIds.length === existing.unitIds.length) {
      return existing;
    }

    await existing.poller.stop();
    return this.createConnection(key, ip, port, mergedUnitIds);
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
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }
}
