import type { PanelStateMessage } from './SyncTypes';

type InsightZone = 1 | 2;

type InsightSnapshot = Partial<
  Record<'setpoint' | 'virtualTemperature' | 'fanSpeed' | 'fanMode', number>
>;

type UnitZoneState = InsightSnapshot & {
  updatedAt: string | null;
};

type InsightUnitState = {
  unitId: number;
  zones: Map<InsightZone, UnitZoneState>;
};

type InsightPanelState = {
  panelId: string;
  units: Map<number, InsightUnitState>;
};

export default class WallpanelInsightsStore {
  private readonly panels = new Map<string, InsightPanelState>();
  private readonly listeners = new Set<(message: PanelStateMessage) => void>();

  applySnapshot(
    panelId: string,
    unitId: number,
    zone: InsightZone,
    snapshot: InsightSnapshot,
    updatedAt = new Date().toISOString(),
  ): void {
    const panel = this.ensurePanel(panelId);
    const unit = this.ensureUnit(panel, unitId);
    const zoneState = this.ensureZone(unit, zone);

    Object.assign(zoneState, snapshot);
    zoneState.updatedAt = updatedAt;
  }

  applyPanelStateMessage(message: PanelStateMessage): void {
    this.applySnapshot(
      message.panelId,
      message.unitId,
      message.zone,
      {
        setpoint: message.setpoint,
        virtualTemperature: message.virtualTemperature,
        fanSpeed: message.fanSpeed,
        fanMode: message.fanMode,
      },
      message.timestamp,
    );

    for (const listener of this.listeners) {
      listener(message);
    }
  }

  getPanelState(panelId: string) {
    return this.panels.get(panelId);
  }

  subscribe(listener: (message: PanelStateMessage) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private ensurePanel(panelId: string): InsightPanelState {
    let panel = this.panels.get(panelId);

    if (!panel) {
      panel = {
        panelId,
        units: new Map<number, InsightUnitState>(),
      };
      this.panels.set(panelId, panel);
    }

    return panel;
  }

  private ensureUnit(panel: InsightPanelState, unitId: number): InsightUnitState {
    let unit = panel.units.get(unitId);

    if (!unit) {
      unit = {
        unitId,
        zones: new Map<InsightZone, UnitZoneState>(),
      };
      panel.units.set(unitId, unit);
    }

    return unit;
  }

  private ensureZone(unit: InsightUnitState, zone: InsightZone): UnitZoneState {
    let zoneState = unit.zones.get(zone);

    if (!zoneState) {
      zoneState = {
        updatedAt: null,
      };
      unit.zones.set(zone, zoneState);
    }

    return zoneState;
  }
}
