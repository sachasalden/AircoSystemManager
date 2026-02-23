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

  private lastSetpointCache = new Map<string, number>();

  private connections = new Map<
    ConnectionKey,
    { client: ModbusClient; service: PolarbearService; isConnected: boolean }
  >();

  private connQueue = new Map<ConnectionKey, Promise<any>>();

  private zone2DisabledForRoom = new Set<RoomKey>();
  private zone2FailCount = new Map<RoomKey, number>();

  private unitCooldownUntil = new Map<string, number>();

  constructor(
    private repository: AircopanelRepository,
    private pollIntervalMs = 5000,
    private modbusTimeoutMs = 10000,
    private requestGapMs = 150,
    private writeFailCooldownMs = 30000,
    private zone2DisableThreshold = 3,
  ) {}

  /* =========================
     START / STOP
  ========================= */

  start() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.tickSafe();
    }, this.pollIntervalMs);

    console.log(
      `[MonitorPolarbearService] started (interval=${this.pollIntervalMs}ms, timeout=${this.modbusTimeoutMs}ms)`,
    );
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    console.log('[MonitorPolarbearService] stopped');
  }

  private async tickSafe() {
    if (this.isTickRunning) return; // voorkomt overlap
    this.isTickRunning = true;

    try {
      await this.tick();
    } catch (err: any) {
      console.error(
        '[MonitorPolarbearService] tick error:',
        err?.message || err,
      );
    } finally {
      this.isTickRunning = false;
    }
  }

  /* =========================
     QUEUE FIX (PER CONNECTION)
  ========================= */

  private enqueue<T>(connKey: ConnectionKey, fn: () => Promise<T>): Promise<T> {
    const previous = this.connQueue.get(connKey) ?? Promise.resolve();

    const next = previous
      .catch(() => {}) // voorkom chain break
      .then(async () => {
        try {
          return await fn();
        } catch (err) {
          throw err;
        }
      });

    this.connQueue.set(
      connKey,
      next.catch(() => {}), // chain alive houden
    );

    return next;
  }

  /* =========================
     CONNECTION MANAGEMENT
  ========================= */

  private getConnKey(ip: string, port: number): ConnectionKey {
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
      try {
        await conn.client.connect(ip, port);
        conn.isConnected = true;
      } catch (err: any) {
        conn.isConnected = false;
        throw new Error(
          `[MonitorPolarbearService] cannot connect to ${ip}:${port} (${err?.message || err})`,
        );
      }
    }

    return conn;
  }

  /* =========================
     HELPERS
  ========================= */

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private getRoomKey(d: DeviceRow): RoomKey {
    return `${d.zoneId}:${d.roomId}:${d.ip}:${d.port}`;
  }

  private setpointKey(ip: string, port: number, unitId: number, zone: Zone) {
    return `${ip}:${port}:${unitId}:zone:${zone}`;
  }

  private unitCooldownKey(ip: string, port: number, unitId: number) {
    return `${ip}:${port}:${unitId}`;
  }

  private approxEqual(a: number, b: number, eps = 0.05) {
    return Math.abs(a - b) <= eps;
  }

  /* =========================
     MAIN TICK
  ========================= */

  private async tick() {
    const devices = (await this.repository.getDevices()) as DeviceRow[];
    if (!devices?.length) return;

    const rooms = new Map<RoomKey, DeviceRow[]>();

    for (const d of devices) {
      const rk = this.getRoomKey(d);
      if (!rooms.has(rk)) rooms.set(rk, []);
      rooms.get(rk)!.push(d);
    }

    for (const [roomKey, devicesInRoom] of rooms.entries()) {
      const unitIds = [
        ...new Set(devicesInRoom.flatMap((d) => d.ids || [])),
      ].sort((a, b) => a - b);

      if (unitIds.length < 2) continue;

      const { ip, port } = devicesInRoom[0];
      const connKey = this.getConnKey(ip, port);

      let conn;
      try {
        conn = await this.ensureConnection(ip, port);
      } catch (err) {
        console.warn(String(err));
        continue;
      }

      const zones: Zone[] = [1, 2];

      for (const zone of zones) {
        const current: { unitId: number; value: number }[] = [];

        for (const unitId of unitIds) {
          try {
            const sp = await this.enqueue(connKey, async () => {
              const value = await conn.service.getSetpoint(unitId, zone);
              await this.sleep(this.requestGapMs);
              return value;
            });

            current.push({ unitId, value: sp });
          } catch (err: any) {
            console.warn(
              `[MonitorPolarbearService] read failed ${ip}:${port} unit=${unitId} zone=${zone}: ${err?.message || err}`,
            );

            conn.isConnected = false;
          }
        }

        if (current.length < 2) continue;

        const changed = current.filter(({ unitId, value }) => {
          const key = this.setpointKey(ip, port, unitId, zone);
          const prev = this.lastSetpointCache.get(key);
          return typeof prev === 'number' && !this.approxEqual(prev, value);
        });

        if (changed.length >= 1) {
          const source = changed[0];

          const targets = current.filter(
            (x) =>
              x.unitId !== source.unitId &&
              !this.approxEqual(x.value, source.value),
          );

          for (const t of targets) {
            const cdKey = this.unitCooldownKey(ip, port, t.unitId);
            if (Date.now() < (this.unitCooldownUntil.get(cdKey) ?? 0)) continue;

            try {
              await this.enqueue(connKey, async () => {
                await conn.service.setSetpoint(t.unitId, zone, source.value);
                await this.sleep(this.requestGapMs);
              });

              this.lastSetpointCache.set(
                this.setpointKey(ip, port, t.unitId, zone),
                source.value,
              );
            } catch (err: any) {
              console.warn(
                `[MonitorPolarbearService] write failed ${ip}:${port} unit=${t.unitId} zone=${zone}: ${err?.message || err}`,
              );

              this.unitCooldownUntil.set(
                cdKey,
                Date.now() + this.writeFailCooldownMs,
              );

              conn.isConnected = false;
            }
          }
        }

        for (const { unitId, value } of current) {
          this.lastSetpointCache.set(
            this.setpointKey(ip, port, unitId, zone),
            value,
          );
        }
      }
    }
  }
}
