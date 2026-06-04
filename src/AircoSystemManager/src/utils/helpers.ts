import { CONFIG, FLAG_BITS, INPUTS } from "../config/runtime.config";
import type { DbAircoPanel, DbModbusUnit, FlagType, RuntimeSettings, VirtualTemperatureTarget, Zone } from "../types/shared.types";

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const log = (message: string): void => {
  const time = new Date().toISOString().split("T")[1].replace("Z", "");
  console.log(`[${time}] ${message}`);
};

export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const zoneRegister = (zone: Zone, zone1: number, zone2: number): number =>
  zone === 1 ? zone1 : zone2;

export const zoneFlagRegister = (zone: Zone): number =>
  zone === 1 ? INPUTS.flagReg7 : INPUTS.flagReg8;

export const round1 = (value: number): number => Math.round(value * 10) / 10;

export const roundHalf = (value: number): number => Math.round(value * 2) / 2;

export const normalizeFanMode = (value: number): number => (value === 0 ? 0 : 1);

export const hasFlag = (flags: number, zone: Zone, type: FlagType): boolean =>
  (flags & (1 << FLAG_BITS[type][zone])) !== 0;

export const candidateKey = (zone: Zone, type: FlagType): string => `${zone}:${type}`;

export const sourceKey = (unitId: number, zone: Zone, type: FlagType): string =>
  `${unitId}:${zone}:${type}`;

export const virtualTempTargetKey = (target: VirtualTemperatureTarget): string =>
  `${target.unitId}:${target.zone}:${target.register}`;

export const setpointSignature = (value: number): string =>
  `setpoint:${round1(value)}`;

export const fanSignature = (fanMode: number, fanSpeed: number): string =>
  `fanMode:${normalizeFanMode(fanMode)}:fanSpeed:${fanSpeed}`;

export const virtualTempSignature = (value: number): string =>
  `virtualTemp:${roundHalf(value)}`;

export const encodeTemperature = (value: number): number =>
  Math.round(roundHalf(value) * 10);

export const decodePendingSetpoint = (raw: number): number => {
  const lowBits = (raw & 0x00c0) >> 6;
  const highBits = (raw & 0xff00) >> 8;

  return round1(((highBits << 2) | lowBits) / 10);
};

export const toNumber = (payload: Buffer): number | null => {
  const value = Number(payload.toString().trim());

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
};

export const parseCommandNumber = (payload: unknown): number | null => {
  if (typeof payload === "number" && Number.isFinite(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const value = record.value ?? record.temperature ?? record.setpoint ?? record.speed ?? record.mode;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const isTimeoutError = (error: unknown): boolean => {
  const err = error as any;

  return (
    err?.name === "TransactionTimedOutError" ||
    String(err?.message ?? "").toLowerCase().includes("timed out") ||
    String(err?.message ?? "").toLowerCase().includes("timeout")
  );
};

export const toPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed);
};

export const toZone = (value: unknown): Zone | null => {
  const parsed = Number(value);

  return parsed === 1 || parsed === 2 ? parsed : null;
};

export const toZones = (values: unknown, fallback: Zone[] = [1]): Zone[] => {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const zones = values
    .map((value) => toZone(value))
    .filter((value): value is Zone => value !== null);

  return zones.length > 0 ? zones : fallback;
};

export const defaultPanelTypeForUnit = (
  unitId: number,
  fallback = "polarbear-v1",
): string => {
  if (unitId === 1) return "polarbear-v1";
  if (unitId === 2) return "polarbear-v3";

  return fallback;
};

export const defaultVirtualTempRegisterForUnit = (unitId: number, type: string): number => {
  if (unitId === 1 || type === "polarbear-v1") return 603;
  if (unitId === 2 || type === "polarbear-v3") return 21051;

  return 603;
};

export const normalizeModbusUnits = (panel: DbAircoPanel): RuntimeSettings["wallpanel"]["units"] => {
  const configuredUnits: DbModbusUnit[] =
    panel.modbusUnits && panel.modbusUnits.length > 0
      ? panel.modbusUnits
      : (panel.ids ?? []).map((id) => ({ id }));

  return configuredUnits.map((unit, index) => {
    const id = toPositiveInt(unit.id, index + 1);
    const type = String(unit.type ?? unit.version ?? defaultPanelTypeForUnit(id, panel.type));
    const zones = toZones(unit.zones, [1]);

    return {
      id,
      name: String(unit.name ?? type.replace("polarbear-", "")),
      type,
      zones,
    };
  });
};

export const applyRuntimeSettings = (settings: RuntimeSettings): void => {
  CONFIG.wallpanel.host = settings.wallpanel.host;
  CONFIG.wallpanel.port = settings.wallpanel.port;
  CONFIG.wallpanel.units = settings.wallpanel.units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    zones: unit.zones,
    type: unit.type,
  }));
  CONFIG.wallpanel.virtualTemperatureTargets = settings.wallpanel.units.map((unit) => ({
    unitId: unit.id,
    name: unit.name,
    zone: unit.zones[0] ?? 1,
    register: defaultVirtualTempRegisterForUnit(unit.id, unit.type),
  }));

  CONFIG.airco.host = settings.airco.host;
  CONFIG.airco.port = settings.airco.port;
  CONFIG.airco.unitId = settings.airco.unitId;
  CONFIG.airco.model = settings.airco.model;
  CONFIG.airco.bidirectional = settings.airco.bidirectional;
};
