
interface Device {
  id: string;
  type: string;
  name: string;
  bidirectional: boolean;
}

interface Airconditioner extends Device {
  maxTemperature: number;
  minTemperature: number;
  maxSetTemperature: number;
  minSetTemperature: number;
  setTemperature: number;
  currentTemperature: number;
  currentFanspeed: number;
  maxFanspeed: number;
  minFanspeed: number;
  data: any;
}

interface AcPanel {
  id: string;
  ip: string;
  port: number;
  ids: Array<string>;
  type: string;
}

export { Device, Airconditioner, AcPanel };
