import PolarbearMonitor from '../../src/Airco/services/PolarbearMonitor';
import ModbusClient from '../../src/Airco/clients/ModbusClient';
import PolarbearService from '../../src/Airco/services/PolarbearService';
import type SyncEchoGuard from '../../src/Airco/services/SyncEchoGuard';
import type { SyncMessage, TopologyRoom } from '../../src/Airco/services/SyncTypes';

jest.mock('../../src/Airco/clients/ModbusClient', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../src/Airco/services/PolarbearService', () => ({
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
  const FAN_MODE = 2;

  const PANEL_SETPOINT_FLAG_ZONE_1 = 0x0001;

  type ClientMock = {
    connect: jest.Mock;
    disconnect: jest.Mock;
  };

  type ServiceMock = {
    getSetpoint: jest.Mock;
    setSetpoint: jest.Mock;
    getVirtualTemperature: jest.Mock;
    setVirtualTemperature: jest.Mock;
    getFanSpeed: jest.Mock;
    setFanSpeed: jest.Mock;
    getFanMode: jest.Mock;
    setFanMode: jest.Mock;
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

  let clientQueue: ClientMock[];
  let serviceQueue: ServiceMock[];

  let createdClients: ClientMock[];
  let createdServices: ServiceMock[];

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
    timestamp: '2026-03-25T10:00:00.000Z',
    ...overrides,
  });

  const createClientMock = (): ClientMock => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  });

  const createServiceMock = (): ServiceMock => ({
    getSetpoint: jest.fn().mockResolvedValue(SETPOINT),
    setSetpoint: jest.fn().mockResolvedValue(undefined),
    getVirtualTemperature: jest.fn().mockResolvedValue(VIRTUAL_TEMP_1),
    setVirtualTemperature: jest.fn().mockResolvedValue(undefined),
    getFanSpeed: jest.fn().mockResolvedValue(FAN_SPEED),
    setFanSpeed: jest.fn().mockResolvedValue(undefined),
    getFanMode: jest.fn().mockResolvedValue(FAN_MODE),
    setFanMode: jest.fn().mockResolvedValue(undefined),
    getFlags: jest.fn().mockResolvedValue(0),
    clearFlag: jest.fn().mockResolvedValue(undefined),
    getPendingSetpoint: jest.fn().mockResolvedValue(23.5),
    getPendingFanMode: jest.fn().mockResolvedValue(4),
  });

  const queueConnection = () => {
    const client = createClientMock();
    const service = createServiceMock();

    clientQueue.push(client);
    serviceQueue.push(service);

    return { client, service };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    echoGuard = {
      remember: jest.fn(),
      consumeIfExpected: jest.fn().mockReturnValue(false),
    };

    onPanelChange = jest.fn().mockResolvedValue(undefined);
    onSnapshot = jest.fn().mockResolvedValue(undefined);

    clientQueue = [];
    serviceQueue = [];
    createdClients = [];
    createdServices = [];

    (ModbusClient as unknown as jest.Mock).mockImplementation(() => {
      const client = clientQueue.shift() ?? createClientMock();
      createdClients.push(client);
      return client;
    });

    (PolarbearService as unknown as jest.Mock).mockImplementation(() => {
      const service = serviceQueue.shift() ?? createServiceMock();
      createdServices.push(service);
      return service;
    });

    monitor = new PolarbearMonitor(
      echoGuard as unknown as SyncEchoGuard,
      onPanelChange,
      onSnapshot,
      MODBUS_TIMEOUT_MS,
      REQUEST_GAP_MS,
    );
  });

  it('should connect once and emit no event on first poll', async () => {
    const { client, service } = queueConnection();

    await monitor.pollRooms(singlePanelRoom);

    expect(ModbusClient).toHaveBeenCalledWith(MODBUS_TIMEOUT_MS);
    expect(PolarbearService).toHaveBeenCalledTimes(1);

    expect(client.connect).toHaveBeenCalledWith('192.168.1.10', 502);
    expect(service.getSetpoint).toHaveBeenNthCalledWith(1, UNIT_10, ZONE_1);
    expect(service.getSetpoint).toHaveBeenNthCalledWith(2, UNIT_10, ZONE_2);
    expect(service.getVirtualTemperature).toHaveBeenNthCalledWith(
      1,
      UNIT_10,
      ZONE_1,
    );
    expect(service.getVirtualTemperature).toHaveBeenNthCalledWith(
      2,
      UNIT_10,
      ZONE_2,
    );
    expect(service.getFlags).toHaveBeenCalledTimes(2);
    expect(onSnapshot).toHaveBeenNthCalledWith(
      1,
      {
        zoneId: 'zone-1',
        roomId: 'room-1',
        panelId: 'panel-1',
        unitId: UNIT_10,
        zone: ZONE_1,
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

  it('should reuse an existing connection on later polls', async () => {
    const { client } = queueConnection();

    await monitor.pollRooms(singlePanelRoom);
    await monitor.pollRooms(singlePanelRoom);

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(PolarbearService).toHaveBeenCalledTimes(1);
  });

  it('should emit panel change when virtual temperature changes on second poll', async () => {
    const { service } = queueConnection();

    service.getVirtualTemperature
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_2)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1);

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
    const { service } = queueConnection();

    echoGuard.consumeIfExpected.mockReturnValue(true);

    service.getVirtualTemperature
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_2)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1);

    await monitor.pollRooms(singlePanelRoom);
    await monitor.pollRooms(singlePanelRoom);

    expect(echoGuard.consumeIfExpected).toHaveBeenCalled();
    expect(onPanelChange).not.toHaveBeenCalled();
  });

  it('should apply an airco fanMode change locally to all panel units in the room', async () => {
    const { service: service1 } = queueConnection();
    const { service: service2 } = queueConnection();

    const message = makeMessage({
      origin: 'airco',
      property: 'fanMode',
      value: 4,
      zone: ZONE_2,
    });

    await monitor.applyAircoChangeLocally(multiPanelRoom, message);

    expect(service1.setFanMode).toHaveBeenCalledWith(UNIT_10, ZONE_2, 4);
    expect(service1.setFanMode).toHaveBeenCalledWith(UNIT_11, ZONE_2, 4);
    expect(service2.setFanMode).toHaveBeenCalledWith(UNIT_20, ZONE_2, 4);

    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-1',
      UNIT_10,
      ZONE_2,
      'fanMode',
      4,
    );
    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-1',
      UNIT_11,
      ZONE_2,
      'fanMode',
      4,
    );
    expect(echoGuard.remember).toHaveBeenCalledWith(
      'panel-2',
      UNIT_20,
      ZONE_2,
      'fanMode',
      4,
    );
  });

  it('should ignore non-airco messages in applyAircoChangeLocally', async () => {
    const message = makeMessage({
      origin: 'panel',
      property: 'fanMode',
    });

    await monitor.applyAircoChangeLocally(multiPanelRoom, message);

    expect(ModbusClient).not.toHaveBeenCalled();
    expect(onPanelChange).not.toHaveBeenCalled();
  });

  it('should ignore unsupported properties in applyAircoChangeLocally', async () => {
    const message = makeMessage({
      origin: 'airco',
      property: 'setpoint',
      value: 23.5,
    });

    await monitor.applyAircoChangeLocally(multiPanelRoom, message);

    expect(ModbusClient).not.toHaveBeenCalled();
  });

  it('should detect panel setpoint flag, clear it, sync sibling panels and emit onPanelChange', async () => {
    const { service: service1 } = queueConnection();
    const { service: service2 } = queueConnection();

    service1.getFlags
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(PANEL_SETPOINT_FLAG_ZONE_1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    service1.getPendingSetpoint.mockResolvedValue(23.5);

    await monitor.pollRooms(multiPanelRoom);
    await monitor.pollRooms(multiPanelRoom);

    expect(service1.getPendingSetpoint).toHaveBeenCalledWith(UNIT_10, ZONE_1);
    expect(service1.clearFlag).toHaveBeenCalledWith(
      UNIT_10,
      ZONE_1,
      'setpoint',
      PANEL_SETPOINT_FLAG_ZONE_1,
    );

    expect(service1.setSetpoint).toHaveBeenCalledWith(UNIT_11, ZONE_1, 23.5);
    expect(service2.setSetpoint).toHaveBeenCalledWith(UNIT_20, ZONE_1, 23.5);
    expect(service1.setSetpoint).not.toHaveBeenCalledWith(
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

  it('should stop and disconnect all open connections', async () => {
    const { client: client1 } = queueConnection();
    const { client: client2 } = queueConnection();

    await monitor.pollRooms(multiPanelRoom);
    await monitor.stop();

    expect(client1.disconnect).toHaveBeenCalled();
    expect(client2.disconnect).toHaveBeenCalled();
  });
});
