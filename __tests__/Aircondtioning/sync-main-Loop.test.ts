import SyncMainLoop from '../../src/Airco/services/SyncMainLoop';
import TopologyService from '../../src/Airco/services/TopologyService';
import MqttSyncBus from '../../src/Airco/services/MqttSyncBus';
import PolarbearMonitor from '../../src/Airco/services/PolarbearMonitor';
import AircoMonitor from '../../src/Airco/services/AircoMonitor';
import type {
  SyncMessage,
  TopologyRoom,
} from '../../src/Airco/services/SyncTypes';
import type AdapterRegistry from '../../src/Airco/adapters/AdapterRegistry';
import type { AircopanelRepository } from '../../src/Airco/repositories/WallpanelRepository';

jest.mock('../../src/Airco/services/TopologyService');
jest.mock('../../src/Airco/services/MqttSyncBus');
jest.mock('../../src/Airco/services/PolarbearMonitor');
jest.mock('../../src/Airco/services/AircoMonitor');

jest.mock('../../src/Airco/services/SyncTypes', () => ({
  ...jest.requireActual('../../src/Airco/services/SyncTypes'),
  createMessageId: jest.fn(() => MESSAGE_ID),
}));

const BROKER_URL = 'mqtt://localhost:1883';
const TOPIC_PREFIX = 'airco/sync';
const SOURCE_INSTANCE_ID = 'instance-1';

const PANEL_LOOP_MS = 1000;
const AIRCO_LOOP_MS = 1000;
const TOPOLOGY_REFRESH_MS = 10000;

const MESSAGE_ID = 'message-1';
const TIMESTAMP = '2026-01-01T12:00:00.000Z';
const SCHEMA = 'aircotest.sync.v4';

const ROOM_ID = 'room-1';
const ROOM_NAME = 'Woonkamer';

const DEVICE_ID = 'airco-1';
const UNIT_ID = 1;
const ZONE = 1;
const PROPERTY = 'setpoint';
const VALUE = 21.5;

const ROOMS = [
  {
    id: ROOM_ID,
    name: ROOM_NAME,
  },
] as unknown as TopologyRoom[];

const createSyncMessage = (origin: 'panel' | 'airco'): SyncMessage =>
  ({
    schema: SCHEMA,
    messageId: MESSAGE_ID,
    sourceInstanceId: 'remote-instance',
    timestamp: TIMESTAMP,
    origin,
    deviceId: DEVICE_ID,
    unitId: UNIT_ID,
    zone: ZONE,
    property: PROPERTY,
    value: VALUE,
  }) as unknown as SyncMessage;

describe('SyncMainLoop', () => {
  let loop: SyncMainLoop;

  let repository: jest.Mocked<AircopanelRepository>;
  let registry: jest.Mocked<AdapterRegistry>;

  let topologyService: {
    getRooms: jest.Mock;
  };

  let mqtt: {
    start: jest.Mock;
    publish: jest.Mock;
    stop: jest.Mock;
  };

  let panelMonitor: {
    pollRooms: jest.Mock;
    applyAircoChangeLocally: jest.Mock;
    stop: jest.Mock;
  };

  let aircoMonitor: {
    pollRooms: jest.Mock;
    applyPanelChangeLocally: jest.Mock;
  };

  let remoteMessageHandler: ((message: SyncMessage) => Promise<void>) | null;
  let panelChangeHandler:
    | ((
        message: Omit<
          SyncMessage,
          'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
        >,
      ) => Promise<void>)
    | null;
  let aircoChangeHandler:
    | ((
        message: Omit<
          SyncMessage,
          'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
        >,
      ) => Promise<void>)
    | null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(TIMESTAMP));

    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    remoteMessageHandler = null;
    panelChangeHandler = null;
    aircoChangeHandler = null;

    repository = {} as jest.Mocked<AircopanelRepository>;
    registry = {} as jest.Mocked<AdapterRegistry>;

    topologyService = {
      getRooms: jest.fn().mockResolvedValue(ROOMS),
    };

    mqtt = {
      start: jest.fn(async (handler) => {
        remoteMessageHandler = handler;
      }),
      publish: jest.fn(),
      stop: jest.fn(),
    };

    panelMonitor = {
      pollRooms: jest.fn(),
      applyAircoChangeLocally: jest.fn(),
      stop: jest.fn(),
    };

    aircoMonitor = {
      pollRooms: jest.fn(),
      applyPanelChangeLocally: jest.fn(),
    };

    (TopologyService as jest.Mock).mockImplementation(() => topologyService);
    (MqttSyncBus as jest.Mock).mockImplementation(() => mqtt);

    (PolarbearMonitor as jest.Mock).mockImplementation(
      (_echoGuard, onChange) => {
        panelChangeHandler = onChange;
        return panelMonitor;
      },
    );

    (AircoMonitor as jest.Mock).mockImplementation(
      (_registry, _echoGuard, onChange) => {
        aircoChangeHandler = onChange;
        return aircoMonitor;
      },
    );

    loop = new SyncMainLoop(
      repository,
      registry,
      BROKER_URL,
      TOPIC_PREFIX,
      SOURCE_INSTANCE_ID,
      PANEL_LOOP_MS,
      AIRCO_LOOP_MS,
      TOPOLOGY_REFRESH_MS,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should start mqtt and polling loops', async () => {
    await loop.start();

    expect(topologyService.getRooms).toHaveBeenCalled();
    expect(mqtt.start).toHaveBeenCalledWith(expect.any(Function));

    expect(panelMonitor.pollRooms).toHaveBeenCalledWith(ROOMS);
    expect(aircoMonitor.pollRooms).toHaveBeenCalledWith(ROOMS);
  });

  it('should apply remote panel message to airco monitor', async () => {
    await loop.start();

    const message = createSyncMessage('panel');

    await remoteMessageHandler!(message);

    expect(aircoMonitor.applyPanelChangeLocally).toHaveBeenCalledWith(
      ROOMS,
      message,
    );
  });

  it('should apply remote airco message to panel monitor', async () => {
    await loop.start();

    const message = createSyncMessage('airco');

    await remoteMessageHandler!(message);

    expect(panelMonitor.applyAircoChangeLocally).toHaveBeenCalledWith(
      ROOMS,
      message,
    );
  });

  it('should publish local panel change and apply it to airco locally', async () => {
    await loop.start();

    const localMessage = {
      origin: 'panel',
      deviceId: DEVICE_ID,
      unitId: UNIT_ID,
      zone: ZONE,
      property: PROPERTY,
      value: VALUE,
    } as unknown as Omit<
      SyncMessage,
      'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
    >;

    await panelChangeHandler!(localMessage);

    const expectedMessage = expect.objectContaining({
      schema: SCHEMA,
      messageId: MESSAGE_ID,
      sourceInstanceId: SOURCE_INSTANCE_ID,
      timestamp: TIMESTAMP,
      origin: 'panel',
      deviceId: DEVICE_ID,
      unitId: UNIT_ID,
      zone: ZONE,
      property: PROPERTY,
      value: VALUE,
    });

    expect(aircoMonitor.applyPanelChangeLocally).toHaveBeenCalledWith(
      ROOMS,
      expectedMessage,
    );

    expect(mqtt.publish).toHaveBeenCalledWith(expectedMessage);
  });

  it('should publish local airco change and apply it to panel locally', async () => {
    await loop.start();

    const localMessage = {
      origin: 'airco',
      deviceId: DEVICE_ID,
      unitId: UNIT_ID,
      zone: ZONE,
      property: PROPERTY,
      value: VALUE,
    } as unknown as Omit<
      SyncMessage,
      'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
    >;

    await aircoChangeHandler!(localMessage);

    const expectedMessage = expect.objectContaining({
      schema: SCHEMA,
      messageId: MESSAGE_ID,
      sourceInstanceId: SOURCE_INSTANCE_ID,
      timestamp: TIMESTAMP,
      origin: 'airco',
      deviceId: DEVICE_ID,
      unitId: UNIT_ID,
      zone: ZONE,
      property: PROPERTY,
      value: VALUE,
    });

    expect(panelMonitor.applyAircoChangeLocally).toHaveBeenCalledWith(
      ROOMS,
      expectedMessage,
    );

    expect(mqtt.publish).toHaveBeenCalledWith(expectedMessage);
  });

  it('should stop timers, panel monitor and mqtt', async () => {
    await loop.start();

    await loop.stop();

    expect(panelMonitor.stop).toHaveBeenCalled();
    expect(mqtt.stop).toHaveBeenCalled();

    const panelPollCount = panelMonitor.pollRooms.mock.calls.length;
    const aircoPollCount = aircoMonitor.pollRooms.mock.calls.length;

    jest.runOnlyPendingTimers();

    expect(panelMonitor.pollRooms).toHaveBeenCalledTimes(panelPollCount);
    expect(aircoMonitor.pollRooms).toHaveBeenCalledTimes(aircoPollCount);
  });

  it('should continue when panel loop fails', async () => {
    const error = new Error('Panel poll failed');
    panelMonitor.pollRooms.mockRejectedValueOnce(error);

    await loop.start();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalledWith(
      '[SyncMainLoop] panel loop failed',
      error,
    );
  });

  it('should continue when airco loop fails', async () => {
    const error = new Error('Airco poll failed');
    aircoMonitor.pollRooms.mockRejectedValueOnce(error);

    await loop.start();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalledWith(
      '[SyncMainLoop] airco loop failed',
      error,
    );
  });
});
