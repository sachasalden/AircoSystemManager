import type { AircoConnection, Zone } from "../../types/shared.types";

export interface AircoAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setSetpoint(unitId: number, zone: Zone, temperature: number): Promise<void>;
  setFanSpeed(unitId: number, zone: Zone, speed: number): Promise<void>;
  setFanMode(unitId: number, zone: Zone, mode: number): Promise<void>;
  getVirtualTemperature(unitId: number, zone: Zone): Promise<number>;
}

export type AircoAdapterFactory = (connection: AircoConnection) => AircoAdapter;

