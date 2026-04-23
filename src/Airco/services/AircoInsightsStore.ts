import type { SyncProperty, Zone } from './SyncTypes';

type AircoSnapshot = Partial<Record<SyncProperty, number>>;

type AircoZoneState = AircoSnapshot & {
  updatedAt: string | null;
};

type AircoUnitState = {
  unitId: number;
  zones: Map<Zone, AircoZoneState>;
};

type AircoState = {
  aircoId: string;
  units: Map<number, AircoUnitState>;
};

export type AircoSnapshotMessage = {
  zoneId: string;
  roomId: string;
  aircoId: string;
  unitId: number;
  zone: Zone;
  snapshot: AircoSnapshot;
  timestamp: string;
};

export default class AircoInsightsStore {
  private readonly aircos = new Map<string, AircoState>();
  private readonly listeners = new Set<(message: AircoSnapshotMessage) => void>();

  applySnapshot(message: AircoSnapshotMessage): void {
    const airco = this.ensureAirco(message.aircoId);
    const unit = this.ensureUnit(airco, message.unitId);
    const zoneState = this.ensureZone(unit, message.zone);

    Object.assign(zoneState, message.snapshot);
    zoneState.updatedAt = message.timestamp;

    for (const listener of this.listeners) {
      listener(message);
    }
  }

  getAircoState(aircoId: string) {
    return this.aircos.get(aircoId);
  }

  subscribe(listener: (message: AircoSnapshotMessage) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private ensureAirco(aircoId: string): AircoState {
    let airco = this.aircos.get(aircoId);

    if (!airco) {
      airco = {
        aircoId,
        units: new Map<number, AircoUnitState>(),
      };
      this.aircos.set(aircoId, airco);
    }

    return airco;
  }

  private ensureUnit(airco: AircoState, unitId: number): AircoUnitState {
    let unit = airco.units.get(unitId);

    if (!unit) {
      unit = {
        unitId,
        zones: new Map<Zone, AircoZoneState>(),
      };
      airco.units.set(unitId, unit);
    }

    return unit;
  }

  private ensureZone(unit: AircoUnitState, zone: Zone): AircoZoneState {
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
