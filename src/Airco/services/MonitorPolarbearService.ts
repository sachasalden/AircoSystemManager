// src/Airco/services/MonitorPolarbearService.ts

import ModbusClient from '../clients/ModbusClient';
import PolarbearService from './PolarbearService';
import { AircopanelRepository } from '../repositories/WallpanelRepository';

type Zone = 1 | 2;

type DeviceRow = {
  id: string;
  ip: string;
  port: number;
  ids: number[];
  zoneId: string;
  roomId: string;
};

type ConnectionKey = string;
type RoomKey = string;

export default class MonitorPolarbearService {
  private timer: NodeJS.Timeout | null = null;
  private isTickRunning = false;

  private lastFanSpeedCache = new Map<string, number>();
  private lastFanModeCache = new Map<string, number>();
  private lastSetpointCache = new Map<string, number>();

  private recentlyWritten = new Map<string, number>();
  private writeIgnoreWindowMs = 1500;

  private connections = new Map<
    ConnectionKey,
    { client: ModbusClient; service: PolarbearService; isConnected: boolean }
  >();

  private connQueue = new Map<ConnectionKey, Promise<any>>();

  constructor(
    private repository: AircopanelRepository,
    private pollIntervalMs = 5000,
    private modbusTimeoutMs = 10000,
    private requestGapMs = 150,
  ) {}

  start() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.tickSafe();
    }, this.pollIntervalMs);

    console.log(`[MonitorPolarbearService] started`);
  }

  private now() {
    return Date.now();
  }

  private writeKey(
    ip: string,
    port: number,
    unitId: number,
    zone: Zone,
    type: 'fs' | 'fm' | 'sp',
  ) {
    return `${ip}:${port}:${unitId}:${zone}:${type}`;
  }

  private getCacheKey(
    ip: string,
    port: number,
    unitId: number,
    zone: Zone,
    type: 'fs' | 'fm' | 'sp',
  ) {
    return `${ip}:${port}:${unitId}:${zone}:${type}`;
  }

  private async tickSafe() {
    if (this.isTickRunning) return;
    this.isTickRunning = true;

    try {
      await this.tick();
    } finally {
      this.isTickRunning = false;
    }
  }

  private enqueue<T>(connKey: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.connQueue.get(connKey) ?? Promise.resolve();

    const next = previous.catch(() => {}).then(async () => await fn());

    this.connQueue.set(
      connKey,
      next.catch(() => {}),
    );
    return next;
  }

  private enqueueWithGap<T>(connKey: string, fn: () => Promise<T>): Promise<T> {
    return this.enqueue(connKey, async () => {
      const result = await fn();
      await new Promise((r) => setTimeout(r, this.requestGapMs));
      return result;
    });
  }

  private getConnKey(ip: string, port: number) {
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

  private async tick() {
    const devices = (await this.repository.getDevices()) as DeviceRow[];
    if (!devices?.length) return;

    const rooms = new Map<RoomKey, DeviceRow[]>();

    for (const d of devices) {
      const rk = `${d.zoneId}:${d.roomId}:${d.ip}:${d.port}`;
      if (!rooms.has(rk)) rooms.set(rk, []);
      rooms.get(rk)!.push(d);
    }

    for (const devicesInRoom of rooms.values()) {
      const unitIds = [...new Set(devicesInRoom.flatMap((d) => d.ids || []))];
      if (unitIds.length < 2) continue;

      const { ip, port } = devicesInRoom[0];
      const connKey = this.getConnKey(ip, port);
      const conn = await this.ensureConnection(ip, port);

      for (const zone of [1, 2] as Zone[]) {
        const speedMap = new Map<number, number>();
        const modeMap = new Map<number, number>();
        const setpointMap = new Map<number, number>();

        for (const unitId of unitIds) {
          speedMap.set(
            unitId,
            await this.enqueueWithGap(connKey, () =>
              conn.service.getFanSpeed(unitId, zone),
            ),
          );

          modeMap.set(
            unitId,
            await this.enqueueWithGap(connKey, () =>
              conn.service.getFanMode(unitId, zone),
            ),
          );

          setpointMap.set(
            unitId,
            await this.enqueueWithGap(connKey, () =>
              conn.service.getSetpoint(unitId, zone),
            ),
          );
        }

        await this.syncProperty(
          ip,
          port,
          zone,
          unitIds,
          speedMap,
          this.lastFanSpeedCache,
          'fs',
          (unitId, value) => conn.service.setFanSpeed(unitId, zone, value),
          connKey,
        );

        await this.syncProperty(
          ip,
          port,
          zone,
          unitIds,
          modeMap,
          this.lastFanModeCache,
          'fm',
          (unitId, value) => conn.service.setFanMode(unitId, zone, value),
          connKey,
        );

        await this.syncProperty(
          ip,
          port,
          zone,
          unitIds,
          setpointMap,
          this.lastSetpointCache,
          'sp',
          (unitId, value) => conn.service.setSetpoint(unitId, zone, value),
          connKey,
        );
      }
    }
  }

  private async syncProperty(
    ip: string,
    port: number,
    zone: Zone,
    unitIds: number[],
    valueMap: Map<number, number>,
    cache: Map<string, number>,
    type: 'fs' | 'fm' | 'sp',
    writeFn: (unitId: number, value: number) => Promise<void>,
    connKey: string,
  ) {
    const changed = [...valueMap.entries()].filter(([unitId, value]) => {
      const cacheKey = this.getCacheKey(ip, port, unitId, zone, type);
      const prev = cache.get(cacheKey);

      if (prev === undefined || prev === value) return false;

      const lastWrite = this.recentlyWritten.get(
        this.writeKey(ip, port, unitId, zone, type),
      );

      if (lastWrite && this.now() - lastWrite < this.writeIgnoreWindowMs) {
        return false;
      }

      return true;
    });

    if (changed.length === 1) {
      const [sourceId, value] = changed[0];

      for (const target of unitIds) {
        if (target === sourceId) continue;

        console.log(`[SYNC ${type}] ${sourceId} -> ${target} value=${value}`);

        await this.enqueueWithGap(connKey, () => writeFn(target, value));

        this.recentlyWritten.set(
          this.writeKey(ip, port, target, zone, type),
          this.now(),
        );
      }
    }

    for (const [unitId, value] of valueMap.entries()) {
      cache.set(this.getCacheKey(ip, port, unitId, zone, type), value);
    }
  }
}
