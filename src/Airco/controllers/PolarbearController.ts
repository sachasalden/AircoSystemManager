import ModbusClient from '../clients/ModbusClient';
import PolarbearService from '../services/PolarbearService';
import WallpanelInsightsStore from '../services/WallpanelInsightsStore';
import {
  AircopanelRepository,
  Device,
} from '../repositories/WallpanelRepository';

export default class PolarbearController {
  private client: ModbusClient;
  private service: PolarbearService;

  constructor(
    private timeout: number,
    private repository: AircopanelRepository,
    private insightsStore: WallpanelInsightsStore,
  ) {
    this.client = new ModbusClient(this.timeout);
    this.service = new PolarbearService(this.client);
  }

  async connect(host: string, port: number): Promise<void> {
    await this.client.connect(host, port);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  handleReconnect(): void {
    this.client.markDisconnected();
  }

  async setTemperature(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    await this.service.setSetpoint(unitId, zone, temperature);
  }

  async getTemperature(unitId: number, zone: 1 | 2): Promise<number> {
    return this.service.getSetpoint(unitId, zone);
  }

  async getVirtualTemperature(unitId: number, zone: 1 | 2): Promise<number> {
    return this.service.getVirtualTemperature(unitId, zone);
  }

  async setVirtualTemperature(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    await this.service.setVirtualTemperature(unitId, zone, temperature);
  }

  async getDevices() {
    return this.repository.getDevices();
  }

  async addDevice(device: Device & { zoneId: string; roomId: string }) {
    return this.repository.addDevice(device);
  }

  async getDeviceById(deviceId: string) {
    return this.repository.getDeviceById(deviceId);
  }

  async deleteDevice(deviceId: string) {
    return this.repository.deleteDevice(deviceId);
  }

  async updateDevice(device: Device) {
    return this.repository.updateDevice(device);
  }

  async getFanSpeed(unitId: number, zone: 1 | 2): Promise<number> {
    return this.service.getFanSpeed(unitId, zone);
  }

  async setFanSpeed(unitId: number, zone: 1 | 2, speed: number): Promise<void> {
    await this.service.setFanSpeed(unitId, zone, speed);
  }

  async getFanMode(unitId: number, zone: 1 | 2): Promise<number> {
    return this.service.getFanMode(unitId, zone);
  }

  async setFanMode(unitId: number, zone: 1 | 2, mode: number): Promise<void> {
    await this.service.setFanMode(unitId, zone, mode);
  }

  async rebootPolarbears(panelId: string, unitIds?: number[]): Promise<number[]> {
    const { panel, targetUnitIds } = await this.getPanelAdminTarget(
      panelId,
      unitIds,
    );

    await this.withPanelConnection(panel.ip, panel.port, async () => {
      for (const unitId of targetUnitIds) {
        await this.service.reboot(unitId);
      }
    });

    return targetUnitIds;
  }

  async setPolarbearBaudrate(
    panelId: string,
    baudrate: number,
    unitIds?: number[],
  ): Promise<number[]> {
    const { panel, targetUnitIds } = await this.getPanelAdminTarget(
      panelId,
      unitIds,
    );

    await this.withPanelConnection(panel.ip, panel.port, async () => {
      for (const unitId of targetUnitIds) {
        await this.service.setBaudrate(unitId, baudrate);
      }
    });

    return targetUnitIds;
  }

  async getRoomWallpanelInsights(zoneId: string, roomId: string) {
    const zones = await this.repository.getZones();

    const zone = zones.find(
      (z: any) => String(z._id ?? z.id ?? '') === String(zoneId),
    );

    if (!zone) {
      throw new Error('Zone not found');
    }

    const room = zone.rooms?.find(
      (r: any) => String(r.id ?? '') === String(roomId),
    );

    if (!room) {
      throw new Error('Room not found');
    }

    const panels = Array.isArray(room.aircopanels) ? room.aircopanels : [];

    const results = [];

    for (const panel of panels) {
      const idsSource = Array.isArray(panel.terminalIds)
        ? panel.terminalIds
        : Array.isArray(panel.ids)
          ? panel.ids
          : [];

      const terminalIds = idsSource
        .map((id: unknown) => Number(id))
        .filter((id: number) => Number.isFinite(id));

      const panelResult = {
        panelId: String(panel.id ?? ''),
        name: panel.name ?? 'Wallpanel',
        ip: panel.ip ?? '',
        port: Number(panel.port ?? 4001),
        type: panel.type ?? panel.version ?? 'unknown',
        terminalIds,
        status: 'ok' as const,
        error: null as string | null,
        units: [] as any[],
      };

      const panelState = this.insightsStore.getPanelState(panelResult.panelId);

      for (const unitId of terminalIds) {
        const unitState = panelState?.units.get(unitId);
        const unitResult = {
          unitId,
          zones: [] as any[],
        };

        for (const zoneNumber of [1, 2] as const) {
          const zoneState = unitState?.zones.get(zoneNumber);

          if (!zoneState) {
            unitResult.zones.push({
              zone: zoneNumber,
              status: 'error',
              error: 'No cached wallpanel data yet',
            });
            continue;
          }

          unitResult.zones.push({
            zone: zoneNumber,
            status: 'ok',
            setpoint: zoneState.setpoint,
            virtualTemperature: zoneState.virtualTemperature,
            fanSpeed: zoneState.fanSpeed,
            fanMode: zoneState.fanMode,
          });
        }

        panelResult.units.push(unitResult);
      }

      results.push(panelResult);
    }

    return {
      zoneId,
      roomId,
      roomName: room.name ?? '',
      generatedAt: new Date().toISOString(),
      panels: results,
    };
  }

  private async getPanelAdminTarget(
    panelId: string,
    unitIds?: number[],
  ): Promise<{ panel: Device; targetUnitIds: number[] }> {
    const panel = await this.repository.getDeviceById(panelId);

    if (!panel) {
      throw new Error('Wallpanel not found');
    }

    const configuredUnitIds = this.normalizeUnitIds(panel.ids);
    const requestedUnitIds = this.normalizeUnitIds(unitIds);
    const targetUnitIds =
      requestedUnitIds.length > 0 ? requestedUnitIds : configuredUnitIds;

    if (!targetUnitIds.length) {
      throw new Error('No terminal IDs configured for this wallpanel');
    }

    for (const unitId of targetUnitIds) {
      if (!configuredUnitIds.includes(unitId)) {
        throw new Error(
          `Terminal ${unitId} is not configured on wallpanel ${panelId}`,
        );
      }
    }

    return { panel, targetUnitIds };
  }

  private async withPanelConnection<T>(
    host: string,
    port: number,
    task: () => Promise<T>,
  ): Promise<T> {
    await this.client.connect(host, port);

    try {
      return await task();
    } finally {
      await this.client.disconnect();
    }
  }

  private normalizeUnitIds(unitIds?: unknown[]): number[] {
    return [...new Set((unitIds || []).map(Number))]
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }
}
