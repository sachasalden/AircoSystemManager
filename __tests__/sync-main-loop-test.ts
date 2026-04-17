import SyncMainLoop from '../src/Airco/services/SyncMainLoop';
import TopologyService from '../src/Airco/services/TopologyService';
import MqttSyncBus from '../src/Airco/services/MqttSyncBus';
import SyncEchoGuard from '../src/Airco/services/SyncEchoGuard';
import PolarbearMonitor from '../src/Airco/services/PolarbearMonitor';
import AircoMonitor from '../src/Airco/services/AircoMonitor';
import {
  createMessageId,
  type PanelStateMessage,
  type SyncMessage,
  type TopologyRoom,
} from '../src/Airco/services/SyncTypes';

jest.mock('../src/Airco/services/TopologyService', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../src/Airco/services/MqttSyncBus', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../src/Airco/services/SyncEchoGuard', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../src/Airco/services/PolarbearMonitor', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../src/Airco/services/AircoMonitor', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../src/Airco/services/SyncTypes', () => {
  const actual = jest.requireActual('../src/Airco/services/SyncTypes');
  return {
    ...actual,
    createMessageId: jest.fn(),
  };
});

describe('SyncMainLoop', () => {
  const BROKER_URL = 'mqtt://localhost:1883';
  const TOPIC_PREFIX = 'airco/sync';
  const SOURCE_INSTANCE_ID = 'instance-1';

  const PANEL_LOOP_MS = 1000;
  const AIRCO_LOOP_MS = 1000;
  const TOPOLOGY_REFRESH_MS = 10000;

  const FIXED_TIMESTAMP = '2026-03-25T10:00:00.000Z';
  const FIXED_MESSAGE_ID = 'msg-123';

  const ROOMS: TopologyRoom[] = [
    {
      zoneId: 'zone-1',
      roomId: 'room-1',
      roomName: 'Room 1',
      panels: [
        {
          id: 'panel-1',
          ip: '192.168.1.10',
          port: 502,
          ids: [1],
          type: 'polarbear',
        },
      ],
      aircos: [
        {
          id: 'airco-1',
          deviceType: 'FC-500PC/FC-1100PC',
          data: {
            type: 'HeinAndHopmanIpSystem',
            deviceTerminalId: 1,
          },
        },
      ],
    },
  ];

  let topologyServiceMock: {
    getRooms: jest.Mock;
  };

  let mqttMock: {
    start: jest.Mock;
    stop: jest.Mock;
    publish: jest.Mock;
    publishPanelState: jest.Mock;
  };

  let echoGuardMock: {
    cleanup: jest.Mock;
  };

  let panelMonitorMock: {
    pollRooms: jest.Mock;
    applyAircoChangeLocally: jest.Mock;
    stop: jest.Mock;
  };

  let aircoMonitorMock: {
    pollRooms: jest.Mock;
    applyPanelChangeLocally: jest.Mock;
  };

  let panelChangeHandler:
    | ((
        message: Omit<
          SyncMessage,
          'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
        >,
      ) => Promise<void>)
    | undefined;

  let aircoChangeHandler:
    | ((
        message: Omit<
          SyncMessage,
          'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
        >,
      ) => Promise<void>)
    | undefined;

  let mqttMessageHandler: ((message: SyncMessage) => Promise<void>) | undefined;
  let panelStateMessageHandler:
    | ((message: PanelStateMessage) => Promise<void>)
    | undefined;

  let loop: SyncMainLoop;
  let insightsStoreMock: {
    applyPanelStateMessage: jest.Mock;
  };

  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(FIXED_TIMESTAMP));

    (createMessageId as jest.Mock).mockReturnValue(FIXED_MESSAGE_ID);

    topologyServiceMock = {
      getRooms: jest.fn().mockResolvedValue(ROOMS),
    };

    mqttMock = {
      start: jest.fn().mockImplementation(async (handlers) => {
        mqttMessageHandler = handlers.onSyncMessage;
        panelStateMessageHandler = handlers.onPanelStateMessage;
      }),
      stop: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
      publishPanelState: jest.fn().mockResolvedValue(undefined),
    };

    echoGuardMock = {
      cleanup: jest.fn(),
    };

    panelMonitorMock = {
      pollRooms: jest.fn().mockResolvedValue(undefined),
      applyAircoChangeLocally: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };

    aircoMonitorMock = {
      pollRooms: jest.fn().mockResolvedValue(undefined),
      applyPanelChangeLocally: jest.fn().mockResolvedValue(undefined),
    };

    insightsStoreMock = {
      applyPanelStateMessage: jest.fn(),
    };

    (TopologyService as unknown as jest.Mock).mockImplementation(
      () => topologyServiceMock,
    );

    (MqttSyncBus as unknown as jest.Mock).mockImplementation(() => mqttMock);

    (SyncEchoGuard as unknown as jest.Mock).mockImplementation(
      () => echoGuardMock,
    );

    (PolarbearMonitor as unknown as jest.Mock).mockImplementation(
      (_echoGuard, handler) => {
        panelChangeHandler = handler;
        return panelMonitorMock;
      },
    );

    (AircoMonitor as unknown as jest.Mock).mockImplementation(
      (_registry, _echoGuard, handler) => {
        aircoChangeHandler = handler;
        return aircoMonitorMock;
      },
    );

    loop = new SyncMainLoop(
      {} as any,
      {} as any,
      {} as any,
      BROKER_URL,
      TOPIC_PREFIX,
      SOURCE_INSTANCE_ID,
      insightsStoreMock as any,
      PANEL_LOOP_MS,
      AIRCO_LOOP_MS,
      TOPOLOGY_REFRESH_MS,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should start topology, mqtt and both poll loops', async () => {
    await loop.start();

    expect(TopologyService).toHaveBeenCalled();
    expect(TopologyService).toHaveBeenCalledWith({}, {});
    expect(MqttSyncBus).toHaveBeenCalledWith(
      BROKER_URL,
      SOURCE_INSTANCE_ID,
      TOPIC_PREFIX,
    );
    expect(SyncEchoGuard).toHaveBeenCalledWith(15000);

    expect(topologyServiceMock.getRooms).toHaveBeenCalledTimes(2);
    expect(mqttMock.start).toHaveBeenCalledTimes(1);

    expect(panelMonitorMock.pollRooms).toHaveBeenCalledWith(ROOMS);
    expect(aircoMonitorMock.pollRooms).toHaveBeenCalledWith(ROOMS);

    expect(echoGuardMock.cleanup).toHaveBeenCalledTimes(2);
  });

  it('should route local airco change to panel monitor and mqtt', async () => {
    await loop.start();

    const message = {
      origin: 'airco',
      zoneId: 'zone-1',
      roomId: 'room-1',
      deviceId: 'airco-1',
      unitId: 1,
      zone: 1 as const,
      property: 'fanMode' as const,
      value: 3,
    };

    await aircoChangeHandler!(message);

    const expectedFullMessage: SyncMessage = {
      schema: 'aircotest.sync.v4',
      messageId: FIXED_MESSAGE_ID,
      sourceInstanceId: SOURCE_INSTANCE_ID,
      timestamp: FIXED_TIMESTAMP,
      ...message,
    };

    expect(panelMonitorMock.applyAircoChangeLocally).toHaveBeenCalledWith(
      ROOMS,
      expectedFullMessage,
    );
    expect(mqttMock.publish).toHaveBeenCalledWith(expectedFullMessage);
  });

  it('should route local panel change to airco monitor and mqtt', async () => {
    await loop.start();

    const message = {
      origin: 'panel',
      zoneId: 'zone-1',
      roomId: 'room-1',
      deviceId: 'panel-1',
      unitId: 1,
      zone: 2 as const,
      property: 'setpoint' as const,
      value: 22.5,
    };

    await panelChangeHandler!(message);

    const expectedFullMessage: SyncMessage = {
      schema: 'aircotest.sync.v4',
      messageId: FIXED_MESSAGE_ID,
      sourceInstanceId: SOURCE_INSTANCE_ID,
      timestamp: FIXED_TIMESTAMP,
      ...message,
    };

    expect(aircoMonitorMock.applyPanelChangeLocally).toHaveBeenCalledWith(
      ROOMS,
      expectedFullMessage,
    );
    expect(mqttMock.publish).toHaveBeenCalledWith(expectedFullMessage);
  });

  it('should route remote panel mqtt message to airco monitor', async () => {
    await loop.start();

    const remoteMessage: SyncMessage = {
      schema: 'aircotest.sync.v4',
      messageId: 'remote-1',
      sourceInstanceId: 'other-instance',
      origin: 'panel',
      zoneId: 'zone-1',
      roomId: 'room-1',
      deviceId: 'panel-1',
      unitId: 1,
      zone: 1,
      property: 'setpoint',
      value: 21.5,
      timestamp: FIXED_TIMESTAMP,
    };

    await mqttMessageHandler!(remoteMessage);

    expect(aircoMonitorMock.applyPanelChangeLocally).toHaveBeenCalledWith(
      ROOMS,
      remoteMessage,
    );
    expect(panelMonitorMock.applyAircoChangeLocally).not.toHaveBeenCalled();
  });

  it('should route remote airco mqtt message to panel monitor', async () => {
    await loop.start();

    const remoteMessage: SyncMessage = {
      schema: 'aircotest.sync.v4',
      messageId: 'remote-2',
      sourceInstanceId: 'other-instance',
      origin: 'airco',
      zoneId: 'zone-1',
      roomId: 'room-1',
      deviceId: 'airco-1',
      unitId: 1,
      zone: 2,
      property: 'fanSpeed',
      value: 4,
      timestamp: FIXED_TIMESTAMP,
    };

    await mqttMessageHandler!(remoteMessage);

    expect(panelMonitorMock.applyAircoChangeLocally).toHaveBeenCalledWith(
      ROOMS,
      remoteMessage,
    );
    expect(aircoMonitorMock.applyPanelChangeLocally).not.toHaveBeenCalled();
  });

  it('should apply remote panel state mqtt messages to insights store', async () => {
    await loop.start();

    const panelStateMessage: PanelStateMessage = {
      schema: 'aircotest.panel-state.v1',
      sourceInstanceId: 'other-instance',
      timestamp: FIXED_TIMESTAMP,
      zoneId: 'zone-1',
      roomId: 'room-1',
      panelId: 'panel-1',
      unitId: 1,
      zone: 1,
      setpoint: 21,
      virtualTemperature: 20.5,
      fanSpeed: 2,
      fanMode: 3,
    };

    await panelStateMessageHandler!(panelStateMessage);

    expect(insightsStoreMock.applyPanelStateMessage).toHaveBeenCalledWith(
      panelStateMessage,
    );
  });

  it('should stop timers, panel monitor and mqtt', async () => {
    await loop.start();

    const panelCallsBeforeStop = panelMonitorMock.pollRooms.mock.calls.length;
    const aircoCallsBeforeStop = aircoMonitorMock.pollRooms.mock.calls.length;
    const topologyCallsBeforeStop =
      topologyServiceMock.getRooms.mock.calls.length;

    await loop.stop();

    expect(panelMonitorMock.stop).toHaveBeenCalledTimes(1);
    expect(mqttMock.stop).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30000);
    await flush();

    expect(panelMonitorMock.pollRooms).toHaveBeenCalledTimes(
      panelCallsBeforeStop,
    );
    expect(aircoMonitorMock.pollRooms).toHaveBeenCalledTimes(
      aircoCallsBeforeStop,
    );
    expect(topologyServiceMock.getRooms).toHaveBeenCalledTimes(
      topologyCallsBeforeStop,
    );
  });
});
