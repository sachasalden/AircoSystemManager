import type { FlagType, RuntimeSettings, Zone } from '../types/shared.types';

export const CONFIG = {
  runMode: 'both' as 'both' | 'polarbearPublisher' | 'aircoBridge',

  wallpanel: {
    defaultPort: 4001,
    timeoutMs: 10000,
    requestGapMs: 100,
    pollIntervalMs: 100,
    reconnectIntervalMs: 10000,

    debounceMs: 5000,
    suppressOwnWriteMs: 12000,

    /**
     * Pause between sequential virtual temperature writes.
     */
    virtualTempWriteGapMs: 300,
  },

  airco: {
    defaultPort: 502,
    defaultUnitId: 1,
    defaultZone: 1 as Zone,
    defaultType: 'HeinAndHopmanIpSystem',
    defaultModel: 'FC-3000DC/FC-3500DC',

    virtualTempPollIntervalMs: 2000,
    requestTimeoutMs: 5000,
  },

  mqtt: {
    broker: process.env.MQTT_BROKER,
    topicBase: process.env.MQTT_TOPIC_BASE ?? 'polarbears/wallpanel/airco',

    retainCommands: false,
    retainStates: true,
    retainedStartupSyncDelayMs: 500,
  },

  control: {
    enabled: true,
    host: '0.0.0.0',
    port: 8088,
    requestBodyLimitBytes: 32 * 1024,
  },

  database: {
    uri:
      process.env.MONGO_URI ??
      'mongodb://wallpanel:wallpanel@localhost:27017/wallpanel_sync?authSource=admin',
    name: process.env.MONGO_DB ?? 'wallpanel_sync',
    climatezonesCollection:
      process.env.MONGO_CLIMATEZONES_COLLECTION ?? 'Climatezones',
    aircoDevicesCollection:
      process.env.MONGO_AIRCO_DEVICES_COLLECTION ?? 'enviormentsaircodevices',
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

export const TOPICS = {
  setTemperatureSet: `${CONFIG.mqtt.topicBase}/setTemperature/set`,
  setTemperatureState: `${CONFIG.mqtt.topicBase}/setTemperature/state`,

  fanModeSet: `${CONFIG.mqtt.topicBase}/fanMode/set`,
  fanModeState: `${CONFIG.mqtt.topicBase}/fanMode/state`,

  fanSpeedSet: `${CONFIG.mqtt.topicBase}/fanSpeed/set`,
  fanSpeedState: `${CONFIG.mqtt.topicBase}/fanSpeed/state`,

  virtualTempState: `${CONFIG.mqtt.topicBase}/virtualTemp/state`,
};

export type MqttTopics = typeof TOPICS;

export const createTopics = (
  settings?: Pick<RuntimeSettings, 'climatezoneId' | 'roomId'>,
): MqttTopics => {
  const topicBase = settings
    ? `${CONFIG.mqtt.topicBase}/${settings.climatezoneId}/${settings.roomId}`
    : CONFIG.mqtt.topicBase;

  return {
    setTemperatureSet: `${topicBase}/setTemperature/set`,
    setTemperatureState: `${topicBase}/setTemperature/state`,

    fanModeSet: `${topicBase}/fanMode/set`,
    fanModeState: `${topicBase}/fanMode/state`,

    fanSpeedSet: `${topicBase}/fanSpeed/set`,
    fanSpeedState: `${topicBase}/fanSpeed/state`,

    virtualTempState: `${topicBase}/virtualTemp/state`,
  };
};
