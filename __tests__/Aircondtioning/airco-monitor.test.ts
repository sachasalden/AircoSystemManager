import AircoMonitor from '../../src/Airco/services/AircoMonitor';
import type AdapterRegistry from '../../src/Airco/adapters/AdapterRegistry';
import type { AircoAdapter } from '../../src/Airco/adapters/IAircoAdapter';
import type SyncEchoGuard from '../../src/Airco/services/SyncEchoGuard';
import type { SyncMessage, TopologyRoom } from '../../src/Airco/services/SyncTypes';

describe('AircoMonitor', () => {
  const HOST = '192.168.55.10';
  const PORT = 502;

  const UNIT_ID = 7;
  const ZONE_1 = 1 as const;
  const ZONE_2 = 2 as const;

  const SETPOINT = 21.5;
  const VIRTUAL_TEMP_1 = 22.0;
  const VIRTUAL_TEMP_2 = 23.0;
  const FAN_SPEED = 3;
  const FAN_MODE = 2;

  const TYPE = 'HeinAndHopmanIpSystem';
  const MODEL = 'FC-500PC/FC-1100PC';

  let adapter: jest.Mocked<AircoAdapter>;
  let registry: jest.Mocked<AdapterRegistry>;
  let echoGuard: {
    remember: jest.Mock;
    consumeIfExpected: jest.Mock;
  };
  let onAircoChange: jest.Mock;
  let monitor: AircoMonitor;

  const rooms: TopologyRoom[] = [
    {
      zoneId: 'zone-1',
      roomId: 'room-1',
      roomName: 'Room 1',
      panels: [],
      aircos: [
        {
          id: 'airco-1',
          deviceType: MODEL,
          data: {
            type: TYPE,
            deviceTerminalId: UNIT_ID,
            deviceId: 'environment-device-1',
            roomTemparatureAddress: '40001',
            roomTemparatureSetPointAddress: '40002',
            fanspeedAddress: '40003',
            fanspeedSetPointAddress: '40004',
          },
          environmentDevice: {
            id: 'environment-device-1',
            name: 'Airco system',
            type: TYPE,
            ip: HOST,
            port: PORT,
            bidirectional: true,
          },
        },
      ],
    },
  ];

  const makeSyncMessage = (
    overrides: Partial<SyncMessage> = {},
  ): SyncMessage => ({
    schema: 'aircotest.sync.v4',
    messageId: 'msg-1',
    sourceInstanceId: 'instance-1',
    origin: 'panel',
    zoneId: 'zone-1',
    roomId: 'room-1',
    deviceId: 'panel-1',
    unitId: UNIT_ID,
    zone: ZONE_1,
    property: 'setpoint',
    value: SETPOINT,
    timestamp: '2026-03-25T10:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    adapter = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getSetpoint: jest.fn(),
      setSetpoint: jest.fn().mockResolvedValue(undefined),
      getVirtualTemperature: jest.fn(),
      setVirtualTemperature: jest.fn().mockResolvedValue(undefined),
      getFanSpeed: jest.fn(),
      setFanSpeed: jest.fn().mockResolvedValue(undefined),
      getFanMode: jest.fn(),
      setFanMode: jest.fn().mockResolvedValue(undefined),
    };

    registry = {
      register: jest.fn(),
      has: jest.fn(),
      create: jest.fn().mockReturnValue(adapter),
    } as unknown as jest.Mocked<AdapterRegistry>;

    echoGuard = {
      remember: jest.fn(),
      consumeIfExpected: jest.fn().mockReturnValue(false),
    };

    onAircoChange = jest.fn().mockResolvedValue(undefined);

    monitor = new AircoMonitor(
      registry,
      echoGuard as unknown as SyncEchoGuard,
      onAircoChange,
    );
  });

  it('should poll rooms and read both zones without emitting on first snapshot', async () => {
    adapter.getSetpoint
      .mockResolvedValueOnce(SETPOINT)
      .mockResolvedValueOnce(SETPOINT);
    adapter.getVirtualTemperature
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1);
    adapter.getFanSpeed
      .mockResolvedValueOnce(FAN_SPEED)
      .mockResolvedValueOnce(FAN_SPEED);
    adapter.getFanMode
      .mockResolvedValueOnce(FAN_MODE)
      .mockResolvedValueOnce(FAN_MODE);

    await monitor.pollRooms(rooms);

    expect(registry.create).toHaveBeenCalledWith(TYPE, {
      host: HOST,
      port: PORT,
      type: TYPE,
      model: MODEL,
      bidirectional: true,
      deviceId: 'environment-device-1',
      deviceTerminalId: UNIT_ID,
      roomTemparatureAddress: '40001',
      roomTemparatureSetPointAddress: '40002',
      fanspeedAddress: '40003',
      fanspeedSetPointAddress: '40004',
    });
    expect(adapter.connect).toHaveBeenCalledTimes(1);
    expect(adapter.disconnect).toHaveBeenCalledTimes(1);

    expect(adapter.getSetpoint).toHaveBeenNthCalledWith(1, UNIT_ID, ZONE_1);
    expect(adapter.getSetpoint).toHaveBeenNthCalledWith(2, UNIT_ID, ZONE_2);
    expect(adapter.getVirtualTemperature).toHaveBeenNthCalledWith(
      1,
      UNIT_ID,
      ZONE_1,
    );
    expect(adapter.getVirtualTemperature).toHaveBeenNthCalledWith(
      2,
      UNIT_ID,
      ZONE_2,
    );
    expect(adapter.getFanSpeed).toHaveBeenNthCalledWith(1, UNIT_ID, ZONE_1);
    expect(adapter.getFanSpeed).toHaveBeenNthCalledWith(2, UNIT_ID, ZONE_2);
    expect(adapter.getFanMode).toHaveBeenNthCalledWith(1, UNIT_ID, ZONE_1);
    expect(adapter.getFanMode).toHaveBeenNthCalledWith(2, UNIT_ID, ZONE_2);

    expect(onAircoChange).not.toHaveBeenCalled();
  });

  it('should emit airco change on second poll when virtual temperature changes', async () => {
    adapter.getSetpoint.mockResolvedValue(SETPOINT);
    adapter.getFanSpeed.mockResolvedValue(FAN_SPEED);
    adapter.getFanMode.mockResolvedValue(FAN_MODE);

    adapter.getVirtualTemperature
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_2)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1);

    await monitor.pollRooms(rooms);
    await monitor.pollRooms(rooms);

    expect(onAircoChange).toHaveBeenCalledWith({
      origin: 'airco',
      zoneId: 'zone-1',
      roomId: 'room-1',
      deviceId: 'airco-1',
      unitId: UNIT_ID,
      zone: ZONE_1,
      property: 'virtualTemperature',
      value: VIRTUAL_TEMP_2,
    });
  });

  it('should not emit change when echoGuard expects the value', async () => {
    adapter.getSetpoint.mockResolvedValue(SETPOINT);
    adapter.getFanSpeed.mockResolvedValue(FAN_SPEED);
    adapter.getFanMode.mockResolvedValue(FAN_MODE);

    adapter.getVirtualTemperature
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1)
      .mockResolvedValueOnce(VIRTUAL_TEMP_2)
      .mockResolvedValueOnce(VIRTUAL_TEMP_1);

    echoGuard.consumeIfExpected.mockReturnValue(true);

    await monitor.pollRooms(rooms);
    await monitor.pollRooms(rooms);

    expect(echoGuard.consumeIfExpected).toHaveBeenCalled();
    expect(onAircoChange).not.toHaveBeenCalled();
  });

  it('should not emit change for setpoint changes from poll snapshot', async () => {
    adapter.getVirtualTemperature.mockResolvedValue(VIRTUAL_TEMP_1);
    adapter.getFanSpeed.mockResolvedValue(FAN_SPEED);
    adapter.getFanMode.mockResolvedValue(FAN_MODE);

    adapter.getSetpoint
      .mockResolvedValueOnce(21.0)
      .mockResolvedValueOnce(21.0)
      .mockResolvedValueOnce(24.0)
      .mockResolvedValueOnce(21.0);

    await monitor.pollRooms(rooms);
    await monitor.pollRooms(rooms);

    expect(onAircoChange).not.toHaveBeenCalled();
  });

  it('should apply panel setpoint change locally', async () => {
    const message = makeSyncMessage({
      origin: 'panel',
      property: 'setpoint',
      value: 23.5,
      zone: ZONE_1,
    });

    await monitor.applyPanelChangeLocally(rooms, message);

    expect(registry.create).toHaveBeenCalledWith(TYPE, {
      host: HOST,
      port: PORT,
      type: TYPE,
      model: MODEL,
      bidirectional: true,
      deviceId: 'environment-device-1',
      deviceTerminalId: UNIT_ID,
      roomTemparatureAddress: '40001',
      roomTemparatureSetPointAddress: '40002',
      fanspeedAddress: '40003',
      fanspeedSetPointAddress: '40004',
    });
    expect(adapter.connect).toHaveBeenCalled();
    expect(adapter.setSetpoint).toHaveBeenCalledWith(UNIT_ID, ZONE_1, 23.5);
    expect(echoGuard.remember).toHaveBeenCalledWith(
      'airco-1',
      UNIT_ID,
      ZONE_1,
      'setpoint',
      23.5,
    );
    expect(adapter.disconnect).toHaveBeenCalled();
  });

  it('should apply panel fan speed change locally', async () => {
    const message = makeSyncMessage({
      origin: 'panel',
      property: 'fanSpeed',
      value: 4,
      zone: ZONE_2,
    });

    await monitor.applyPanelChangeLocally(rooms, message);

    expect(adapter.setFanSpeed).toHaveBeenCalledWith(UNIT_ID, ZONE_2, 4);
    expect(echoGuard.remember).toHaveBeenCalledWith(
      'airco-1',
      UNIT_ID,
      ZONE_2,
      'fanSpeed',
      4,
    );
  });

  it('should apply panel fan mode change locally', async () => {
    const message = makeSyncMessage({
      origin: 'panel',
      property: 'fanMode',
      value: 3,
      zone: ZONE_1,
    });

    await monitor.applyPanelChangeLocally(rooms, message);

    expect(adapter.setFanMode).toHaveBeenCalledWith(UNIT_ID, ZONE_1, 3);
    expect(echoGuard.remember).toHaveBeenCalledWith(
      'airco-1',
      UNIT_ID,
      ZONE_1,
      'fanMode',
      3,
    );
  });

  it('should ignore non-panel messages in applyPanelChangeLocally', async () => {
    const message = makeSyncMessage({
      origin: 'airco',
      property: 'setpoint',
    });

    await monitor.applyPanelChangeLocally(rooms, message);

    expect(registry.create).not.toHaveBeenCalled();
    expect(adapter.setSetpoint).not.toHaveBeenCalled();
  });

  it('should ignore unsupported property in applyPanelChangeLocally', async () => {
    const message = makeSyncMessage({
      origin: 'panel',
      property: 'virtualTemperature',
      value: 25,
    });

    await monitor.applyPanelChangeLocally(rooms, message);

    expect(registry.create).not.toHaveBeenCalled();
    expect(adapter.setVirtualTemperature).not.toHaveBeenCalled();
  });

  it('should ignore message when room is not found', async () => {
    const message = makeSyncMessage({
      zoneId: 'unknown-zone',
      roomId: 'unknown-room',
    });

    await monitor.applyPanelChangeLocally(rooms, message);

    expect(registry.create).not.toHaveBeenCalled();
  });

  it('should skip airco without valid type or unit id during poll', async () => {
    const invalidRooms: TopologyRoom[] = [
      {
        zoneId: 'zone-1',
        roomId: 'room-1',
        roomName: 'Room 1',
        panels: [],
        aircos: [
          {
            id: 'airco-invalid',
            deviceType: MODEL,
            data: {
              type: undefined,
              deviceTerminalId: 'not-a-number',
            },
          },
        ],
      },
    ];

    await monitor.pollRooms(invalidRooms);

    expect(registry.create).not.toHaveBeenCalled();
    expect(onAircoChange).not.toHaveBeenCalled();
  });
});
