import type { Zone } from '../model';

export type AircoInsightZone = {
  zone: 1 | 2;
  status: 'ok' | 'error';
  error?: string;
  setpoint?: number;
  virtualTemperature?: number;
  fanSpeed?: number;
  fanMode?: number;
  updatedAt?: string | null;
  commands?: string[];
};

export type AircoInsight = {
  aircoId: string;
  name: string;
  deviceType: string;
  adapterType: string;
  environmentDeviceId: string;
  unitId: number | null;
  commands: string[];
  zones: AircoInsightZone[];
};

export type AircoInsightsResponse = {
  zoneId: string;
  roomId: string;
  roomName: string;
  generatedAt: string;
  aircos: AircoInsight[];
};

export type AircoInsightsProps = {
  zones: Zone[];
  selectedZoneId: string | null;
  selectedRoomId: string | null;
  setSelectedZoneId: (zoneId: string | null) => void;
  setSelectedRoomId: (roomId: string | null) => void;
};
