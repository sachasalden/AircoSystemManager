import type { FlagType, Unit, VirtualTemperatureTarget, Zone } from "../types/shared.types";

export const CONFIG = {
  runMode: "both" as "both" | "polarbearPublisher" | "aircoBridge",

  wallpanel: {
    host: "192.168.55.97",
    port: 4001,
    timeoutMs: 10000,
    requestGapMs: 100,
    pollIntervalMs: 100,

    debounceMs: 5000,
    suppressOwnWriteMs: 12000,

    /**
     * Pause between virtualTemp writes:
     * unit 1 register 603 -> 300ms -> unit 2 register 21051
     */
    virtualTempWriteGapMs: 300,

    /**
     * Normal setTemperature/fan-sync.
     * Alleen zone 1.
     */
    units: [
      { id: 1, name: "v1", zones: [1] },
      { id: 2, name: "v3", zones: [1] },
    ] as Unit[],

    /**
     * VirtualTemp only zone 1:
     * - unit 1 / v1 -> register 603
     * - unit 2 / v3 -> register 21051
     */
    virtualTemperatureTargets: [
      { unitId: 1, name: "v1", zone: 1, register: 603 },
      { unitId: 2, name: "v3", zone: 1, register: 21051 },
    ] as VirtualTemperatureTarget[],
  },

  airco: {
    host: "192.168.55.10",
    port: 502,
    unitId: 1,
    zone: 1 as Zone,

    model: "FC-3000DC/FC-3500DC",
    bidirectional: true,

    virtualTempPollIntervalMs: 2000,
    requestTimeoutMs: 5000,
  },

  mqtt: {
    broker: "mqtt://192.168.55.10",
    topicBase: "polarbears/wallpanel/airco",

    retainCommands: false,
    retainStates: true,
  },

  control: {
    enabled: true,
    host: "0.0.0.0",
    port: 8088,
    requestBodyLimitBytes: 32 * 1024,
  },

  database: {
    uri:
      process.env.MONGO_URI ??
      "mongodb://wallpanel:wallpanel@localhost:27017/wallpanel_sync?authSource=admin",
    name: process.env.MONGO_DB ?? "wallpanel_sync",
    climatezonesCollection: "Climatezones",
    aircoDevicesCollection: "enviormentsaircodevices",
  },
};

export const REGISTERS = {
  zone1Setpoint: 601,
  zone1FanMode: 606,
  zone1FanSpeed: 607,
  zone2Setpoint: 701,
  zone2FanMode: 706,
  zone2FanSpeed: 707,
  baudRate: 9002,
};

export const COILS = {
  reboot: 9991,
};

export const BAUDRATE_VALUES: Record<number, number> = {
  9600: 2,
  19200: 3,
  57600: 4,
  115200: 5,
};

export const INPUTS = {
  flagReg0: 110,
  flagReg7: 117,
  flagReg8: 118,
};

export const FLAG_BITS: Record<FlagType, Record<Zone, number>> = {
  setpoint: {
    1: 0,
    2: 8,
  },
  fanMode: {
    1: 1,
    2: 9,
  },
};

export const DEVICE_TYPE_A = "FC-500PC/FC-1100PC";
export const DEVICE_TYPE_B = "FC-3000DC/FC-3500DC";

export const TOPICS = {
  setTemperatureSet: `${CONFIG.mqtt.topicBase}/setTemperature/set`,
  setTemperatureState: `${CONFIG.mqtt.topicBase}/setTemperature/state`,

  fanModeSet: `${CONFIG.mqtt.topicBase}/fanMode/set`,
  fanModeState: `${CONFIG.mqtt.topicBase}/fanMode/state`,

  fanSpeedSet: `${CONFIG.mqtt.topicBase}/fanSpeed/set`,
  fanSpeedState: `${CONFIG.mqtt.topicBase}/fanSpeed/state`,

  virtualTempState: `${CONFIG.mqtt.topicBase}/virtualTemp/state`,
};

/* -------------------------------------------------------------------------- */
/* utils/helpers.ts */
