import PolarbearMonitor from '../../src/Airco/services/PolarbearMonitor';
import WallpanelPoller from '../../src/Airco/services/WallpanelPoller';
import type SyncEchoGuard from '../../src/Airco/services/SyncEchoGuard';
import type { SyncMessage, TopologyRoom } from '../../src/Airco/services/SyncTypes';

jest.mock('../../src/Airco/services/WallpanelPoller', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('PolarbearMonitor', () => {
  const MODBUS_TIMEOUT_MS = 5000;
  const REQUEST_GAP_MS = 0;

  const UNIT_10 = 10;
  const UNIT_11 = 11;
  const UNIT_20 = 20;

  const ZONE_1 = 1 as const;
  const ZONE_2 = 2 as const;

  const SETPOINT = 21.5;
  const VIRTUAL_TEMP_1 = 22.0;
  const VIRTUAL_TEMP_2 = 23.0;
  const FAN_SPEED = 3;
  const FAN_MODE = 1;
  const SNAPSHOT_TIMESTAMP = '2026-03-25T10:00:00.000Z';

  const PANEL_SETPOINT_FLAG_ZONE_1 = 0x0001;

  type PollerMock = {
    stop: jest.Mock;
    getSnapshot: jest.Mock;
    setSetpoint: jest.Mock;
    setVirtualTemp: jest.Mock;
    setFanSpeed: jest.Mock;
    setFanMode: jest.Mock;
    getFanSpeed: jest.Mock;
    getFlags: jest.Mock;
    clearFlag: jest.Mock;
    getPendingSetpoint: jest.Mock;
    getPendingFanMode: jest.Mock;
  };

  let echoGuard: {
    remember: jest.Mock;
    consumeIfExpected: jest.Mock;
  };

  let onPanelChange: jest.Mock;
  let onSnapshot: jest.Mock;

  let pollerQueue: PollerMock[];
  let createdPollers: PollerMock[];

  let monitor: PolarbearMonitor;

  const singlePanelRoom: TopologyRoom[] = [
    {
      zoneId: 'zone-1',
      roomId: 'room-1',
      roomName: 'Room 1',
      aircos: [],
      panels: [
        {
          id: 'panel-1',
          ip: '192.168.1.10',
          port: 502,
          ids: [UNIT_10],
          type: 'polarbear',
        },
      ],
    },
  ];

  const multiPanelRoom: TopologyRoom[] = [
    {
      zoneId: 'zone-1',
      roomId: 'room-1',
      roomName: 'Room 1',
      aircos: [],
      panels: [
        {
          id: 'panel-1',
          ip: '192.168.1.10',
          port: 502,
          ids: [UNIT_10, UNIT_11],
          type: 'polarbear',
        },
        {
          id: 'panel-2',
          ip: '192.168.1.11',
          port: 502,
          ids: [UNIT_20],
          type: 'polarbear',
        },
      ],
    },
  ];

  const makeMessage = (overrides: Partial<SyncMessage> = {}): SyncMessage => ({
    schema: 'aircotest.sync.v4',
    messageId: 'msg-1',
    sourceInstanceId: 'instance-1',
    origin: 'airco',
    zoneId: 'zone-1',
    roomId: 'room-1',
    deviceId: 'airco-1',
    unitId: UNIT_10,
    zone: ZONE_1,
    property: 'fanMode',
    value: FAN_MODE,
    timestamp: SNAPSHOT_TIMESTAMP,
    ...overrides,
  });

  const makeFullSnapshot = (
    unitId: number,
    zone1VirtualTemp = VIRTUAL_TEMP_1,
    zone2VirtualTemp = VIRTUAL_TEMP_1,
  ) => ({
    unitId,
    zone1: {
      setpoint: SETPOINT,
      virtualTemp: zone1VirtualTemp,
      fanSpeed: FAN_SPEED,
      fanMode: FAN_MODE,
    },
    zone2: {
      setpoint: SETPOINT,
      virtualTemp: zone2VirtualTemp,
      fanSpeed: FAN_SPEED,
      fanMode: FAN_MODE,
    },
    timestamp: SNAPSHOT_TIMESTAMP,
  });

  const createPollerMock = (): PollerMock => ({
    stop: jest.fn().mockResolvedValue(undefined),
    getSnapshot: jest
      .fn()
      .mockImplementation((unitId: number) =>
        Promise.resolve(makeFullSnapshot(unitId)),
      ),
    setSetpoint: jest.fn().mockResolvedValue(undefined),
    setVirtualTemp: jest.fn().mockResolvedValue(undefined),
    setFanSpeed: jest.fn().mockResolvedValue(undefined),
    setFanMode: jest.fn().mockResolvedValue(undefined),
    getFanSpeed: jest.fn().mockResolvedValue(FAN_SPEED),
    getFlags: jest.fn().mockResolvedValue(0),
    clearFlag: jest.fn().mockResolvedValue(undefined),
    getPendingSetpoint: jest.fn().mockResolvedValue(23.5),
    getPendingFanMode: jest.fn().mockResolvedValue(4),
  });

  const queuePoller = () => {
    const poller = createPollerMock();
    pollerQueue.push(poller);
    return poller;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    echoGuard = {
      remember: jest.fn(),
      consumeIfExpected: jest.fn().mockReturnValue(false),
    };

    onPanelChange = jest.fn().mockResolvedValue(undefined);
    onSnapshot = jest.fn().mockResolvedValue(undefined);

    pollerQueue = [];
    createdPollers = [];

    (WallpanelPoller as unknown as jest.Mock).mockImplementation(() => {
      const poller = pollerQueue.shift() ?? createPollerMock();
      createdPollers.push(poller);
      return poller;
    });

    monitor = new PolarbearMonitor(
      echoGuard as unknown as SyncEchoGuard,
      onPanelChange,
      onSnapshot,
      MODBUS_TIMEOUT_MS,
      REQUEST_GAP_MS,
      0,
    );
  });

  it('should create one poller and emit no event on first poll', async () => {
    const poller = queuePoller();

    await monitor.pollRooms(singlePanelRoom);

    expect(WallpanelPoller).toHaveBeenCalledWith({
      host: '192.168.1.10',
      port: 502,
      unitIds: [UNIT_10],
      unitTypes: {},
      minInterMessageGapMs: REQUEST_GAP_MS,
      timeoutMs: MODBUS_TIMEOUT_MS,
      reconnectDelayMs: 5000,
    });

    expect(poller.getSnapshot).toHaveBeenCalledWith(UNIT_10);
    expect(poller.getFlags).toHaveBeenCalledTimes(2);
    expect(onSnapshot).toHaveBeenNthCalledWith(
      1,
      {
        zoneId: 'zone-1',
        roomId: 'room-1',
        panelId: 'panel-1',
        unitId: UNIT_10,
        zone: ZONE_1,
        timestamp: SNAPSHOT_TIMESTAMP,
      },
      {
        setpoint: SETPOINT,
        virtualTemperature: VIRTUAL_TEMP_1,
        fanSpeed: FAN_SPEED,
        fanMode: FAN_MODE,
      },
    );
    expect(onSnapshot).toHaveBeenNthCalledWith(
      2,
      {
        zoneId: 'zone-1',
        roomId: 'room-1',
        panelId: 'panel-1',
        unitId: UNIT_10,
        zone: ZONE_2,
        timestamp: SNAPSHOT_TIMESTAMP,
      },
      {
        setpoint: SETPOINT,
        virtualTemperature: VIRTUAL_TEMP_1,
        fanSpeed: FAN_SPEED,
        fanMode: FAN_MODE,
      },
    );
    expect(onPanelChange).not.toHaveBeenCalled();
  });

  it('should reuse an existing poller on later polls', async () => {
    queuePoller();

    await monitor.pollRooms(singlePanelRoom);
    await monitor.pollRooms(singlePanelRoom);

    expect(WallpanelPoller).toHaveBeenCalledTimes(1);
    expect(createdPollers[0].getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('should emit panel change when virtual temperature changes on second poll', async () => {
    const poller = queuePoller();

    poller.getSnapshot
      .mockResolvedValueOnce(makeFullSnapshot(UNIT_10))
      .mockResolvedValueOnce(makeFullSnapshot(UNIT_10, VIRTUAL_TEMP_2));

    await monitor.pollRooms(singlePanelRoom);
    await monitor.pollRooms(singlePanelRoom);

    expect(onPanelChange).toHaveBeenCalledWith({
      origin: 'panel',
      zoneId: 'zone-1',
      roomId: 'room-1',
      deviceId: 'panel-1',
      unitId: UNIT_10,
      zone: ZONE_1,
      property: 'virtualTemperature',
      value: VIRTUAL_TEMP_2,
    });
  });

  it('should suppress virtual temperature change when echoGuard expects it', async () => {
    const poller = queuePoller();

    echoGuard.consumeIfExpected.mockReturnValue(true);

    poller.getSnapshot
      .mockResolvedValueOnce(makeFullSnapshot(UNIT_10))
      .mockResolvedValueOnce(makeFullSnapshot(UNIT_10, VIRTUAL_TEMP_2));

    await monitor.pollRooms(singlePanelRoom);
    await monitor.pollRooms(singlePanelRoom);

    expect(echoGuard.consumeIfExpected).toHaveBeenCalled();
    expect(onPanelChange).not.toHaveBeenCalled();
  });

  it('should apply an airco fanMode change locally to all panel units in the room', async () => {
    const poller1 = queuePoller();
    const poller2 = queuePoller();

    const message = makeMessage({
      origin: 'airco',
      property: 'fanMode',
      value: 4,
      zone: ZONE_2,
    });

    await monitor.applyAircoChangeLocally(multiPanelRoom, message);

    expect(poller1.setFanMode).toHaveBeenCalledWith(UNIT_10, ZONE_2, 1);
    expect(poller1.setFanMode).toHaveBeenCalledWith(UNIT_11, ZONE_2, 1);
    expect(poller2.setFanMode).toHaveBeenCalledWith(UNIT_20, ZONE_2, 1);

    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-1',
      UNIT_10,
      ZONE_2,
      'fanMode',
      1,
    );
    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-1',
      UNIT_11,
      ZONE_2,
      'fanMode',
      1,
    );
    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-2',
      UNIT_20,
      ZONE_2,
      'fanMode',
      1,
    );
  });

  it('should ignore non-airco messages in applyAircoChangeLocally', async () => {
    const message = makeMessage({
      origin: 'panel',
      property: 'fanMode',
    });

    await monitor.applyAircoChangeLocally(multiPanelRoom, message);

    expect(WallpanelPoller).not.toHaveBeenCalled();
    expect(onPanelChange).not.toHaveBeenCalled();
  });

  it('should apply an airco fanSpeed change without writing fanMode to panels', async () => {
    const poller1 = queuePoller();
    const poller2 = queuePoller();

    const message = makeMessage({
      property: 'fanSpeed',
      value: 3,
      zone: ZONE_1,
    });

    await monitor.applyAircoChangeLocally(multiPanelRoom, message);

    expect(poller1.setFanSpeed).toHaveBeenCalledWith(UNIT_10, ZONE_1, 3);
    expect(poller1.setFanSpeed).toHaveBeenCalledWith(UNIT_11, ZONE_1, 3);
    expect(poller2.setFanSpeed).toHaveBeenCalledWith(UNIT_20, ZONE_1, 3);

    expect(poller1.setFanMode).not.toHaveBeenCalled();
    expect(poller2.setFanMode).not.toHaveBeenCalled();

    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-1',
      UNIT_10,
      ZONE_1,
      'fanSpeed',
      3,
    );
  });

  it('should detect panel setpoint flag, clear it, sync sibling panels and emit onPanelChange', async () => {
    const poller1 = queuePoller();
    const poller2 = queuePoller();

    poller1.getFlags
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(PANEL_SETPOINT_FLAG_ZONE_1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    poller1.getPendingSetpoint.mockResolvedValue(23.5);

    await monitor.pollRooms(multiPanelRoom);
    await monitor.pollRooms(multiPanelRoom);

    expect(poller1.getPendingSetpoint).toHaveBeenCalledWith(UNIT_10, ZONE_1);
    expect(poller1.clearFlag).toHaveBeenCalledWith(
      UNIT_10,
      ZONE_1,
      'setpoint',
      PANEL_SETPOINT_FLAG_ZONE_1,
    );

    expect(poller1.setSetpoint).toHaveBeenCalledWith(UNIT_11, ZONE_1, 23.5);
    expect(poller2.setSetpoint).toHaveBeenCalledWith(UNIT_20, ZONE_1, 23.5);
    expect(poller1.setSetpoint).not.toHaveBeenCalledWith(
      UNIT_10,
      ZONE_1,
      23.5,
    );

    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-1',
      UNIT_11,
      ZONE_1,
      'setpoint',
      23.5,
    );
    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-2',
      UNIT_20,
      ZONE_1,
      'setpoint',
      23.5,
    );

    expect(onPanelChange).toHaveBeenCalledWith({
      origin: 'panel',
      zoneId: 'zone-1',
      roomId: 'room-1',
      deviceId: 'panel-1',
      unitId: UNIT_10,
      zone: ZONE_1,
      property: 'setpoint',
      value: 23.5,
    });
  });

  it('should stop and disconnect all open pollers', async () => {
    const poller1 = queuePoller();
    const poller2 = queuePoller();

    await monitor.pollRooms(multiPanelRoom);
    await monitor.stop();

    expect(poller1.stop).toHaveBeenCalled();
    expect(poller2.stop).toHaveBeenCalled();
  });
});
