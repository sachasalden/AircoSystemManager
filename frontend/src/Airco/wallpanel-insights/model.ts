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
  flags?: number;
  pendingSetpoint?: number;
  pendingFanMode?: number;
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

export function valueOrDash(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : '—';
}
