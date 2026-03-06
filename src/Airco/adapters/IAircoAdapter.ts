export type AircoZone = 1 | 2;

export type AircoConnection = {
  host: string;
  port: number;
  timeoutMs?: number;
};

export interface AircoAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  getSetpoint(unitId: number, zone: AircoZone): Promise<number>;
  setSetpoint(unitId: number, zone: AircoZone, temperature: number): Promise<void>;

  getVirtualTemperature(unitId: number, zone: AircoZone): Promise<number>;
  setVirtualTemperature(unitId: number, zone: AircoZone, temperature: number,): Promise<void>;

  getFanSpeed(unitId: number, zone: AircoZone): Promise<number>;
  setFanSpeed(unitId: number, zone: AircoZone, speed: number): Promise<void>;

  getFanMode(unitId: number, zone: AircoZone): Promise<number>;
  setFanMode(unitId: number, zone: AircoZone, mode: number): Promise<void>;
}
