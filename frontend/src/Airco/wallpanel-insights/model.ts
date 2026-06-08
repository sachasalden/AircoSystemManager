import { type Dispatch, type SetStateAction } from 'react';

export type InsightZone = {
  id: string;
  name: string;
  rooms: {
    id: string;
    name: string;
  }[];
};

export type WallpanelInsightsProps = {
  zones: InsightZone[];
  selectedZoneId: string | null;
  selectedRoomId: string | null;
  setSelectedZoneId: Dispatch<SetStateAction<string | null>>;
  setSelectedRoomId: Dispatch<SetStateAction<string | null>>;
};

export type InsightZoneSnapshot = {
  zone: 1 | 2;
  status: 'ok' | 'error';
  setpoint?: number;
  virtualTemperature?: number;
  fanSpeed?: number;
  fanMode?: number;
  error?: string;
};

export type InsightUnit = {
  unitId: number;
  zones: InsightZoneSnapshot[];
};

export type InsightPanel = {
  panelId: string;
  name: string;
  ip: string;
  port: number;
  type?: string;
  terminalIds: number[];
  status: 'ok' | 'error';
  error: string | null;
  units: InsightUnit[];
};

export type InsightResponse = {
  roomName: string;
  generatedAt: string;
  panels: InsightPanel[];
};

export type PolarbearLoopStatus = {
  paused: boolean;
  running: boolean;
  error?: string;
  queuedAircoMessages?: number;
};

export function valueOrDash(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : '—';
}

export function halfStepOrDash(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
