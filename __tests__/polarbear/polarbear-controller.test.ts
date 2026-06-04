import PolarbearController from '../../src/Airco/controllers/PolarbearController';
import ModbusClient from '../../src/Airco/clients/ModbusClient';
import PolarbearService from '../../src/Airco/services/PolarbearService';

jest.mock('../../src/Airco/clients/ModbusClient');
jest.mock('../../src/Airco/services/PolarbearService');

describe('PolarbearController', () => {
  const TIMEOUT_MS = 10000;
  const HOST = '192.168.55.10';
  const PORT = 502;

  const UNIT_ID = 1;
  const ZONE_1 = 1 as const;
  const ZONE_2 = 2 as const;

  const TEMPERATURE = 21.5;
  const VIRTUAL_TEMPERATURE = 22.3;
  const FAN_SPEED = 3;
  const FAN_MODE = 2;

  const DEVICE_ID = 'device-1';

  const DEVICE = {
    _id: DEVICE_ID,
    name: 'Airco 1',
    zoneId: 'zone-1',
    roomId: 'room-1',
    data: {
      type: 'polarbear',
      deviceTerminalId: UNIT_ID,
    },
  };

  let controller: PolarbearController;

  let repositoryMock: {
    getDevices: jest.Mock;
    addDevice: jest.Mock;
    getDeviceById: jest.Mock;
    deleteDevice: jest.Mock;
    updateDevice: jest.Mock;
  };

  let clientMock: {
    connect: jest.Mock;
    disconnect: jest.Mock;
    markDisconnected: jest.Mock;
  };

  let serviceMock: {
    setSetpoint: jest.Mock;
    getSetpoint: jest.Mock;
    getVirtualTemperature: jest.Mock;
    setVirtualTemperature: jest.Mock;
    getFanSpeed: jest.Mock;
    setFanSpeed: jest.Mock;
    getFanMode: jest.Mock;
    setFanMode: jest.Mock;
  };

  const logResult = (label: string, actual: unknown, expected?: unknown) => {
    console.log(`\n[TEST] ${label}`);
    console.log('actual  :', actual);
    if (expected !== undefined) {
      console.log('expected:', expected);
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    repositoryMock = {
      getDevices: jest.fn(),
      addDevice: jest.fn(),
      getDeviceById: jest.fn(),
      deleteDevice: jest.fn(),
      updateDevice: jest.fn(),
    };

    clientMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      markDisconnected: jest.fn(),
    };

    serviceMock = {
      setSetpoint: jest.fn().mockResolvedValue(undefined),
      getSetpoint: jest.fn(),
      getVirtualTemperature: jest.fn(),
      setVirtualTemperature: jest.fn().mockResolvedValue(undefined),
      getFanSpeed: jest.fn(),
      setFanSpeed: jest.fn().mockResolvedValue(undefined),
      getFanMode: jest.fn(),
      setFanMode: jest.fn().mockResolvedValue(undefined),
    };

    (ModbusClient as unknown as jest.Mock).mockImplementation(() => clientMock);
    (PolarbearService as unknown as jest.Mock).mockImplementation(
      () => serviceMock,
    );

    controller = new PolarbearController(TIMEOUT_MS, repositoryMock as any);
  });

  it('should create ModbusClient with timeout', () => {
    logResult('constructor timeout', TIMEOUT_MS, TIMEOUT_MS);

    expect(ModbusClient).toHaveBeenCalledWith(TIMEOUT_MS);
    expect(PolarbearService).toHaveBeenCalledWith(clientMock);
  });

  it('should connect through client', async () => {
    await controller.connect(HOST, PORT);

    logResult('connect', [HOST, PORT], [HOST, PORT]);

    expect(clientMock.connect).toHaveBeenCalledWith(HOST, PORT);
  });

  it('should disconnect through client', async () => {
    await controller.disconnect();

    logResult('disconnect called', true, true);

    expect(clientMock.disconnect).toHaveBeenCalled();
  });

  it('should handle reconnect through client', () => {
    controller.handleReconnect();

    logResult('handleReconnect called', true, true);

    expect(clientMock.markDisconnected).toHaveBeenCalled();
  });

  it('should set temperature through service', async () => {
    await controller.setTemperature(UNIT_ID, ZONE_1, TEMPERATURE);

    logResult(
      'setTemperature',
      [UNIT_ID, ZONE_1, TEMPERATURE],
      [UNIT_ID, ZONE_1, TEMPERATURE],
    );

    expect(serviceMock.setSetpoint).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_1,
      TEMPERATURE,
    );
  });

  it('should get temperature through service', async () => {
    serviceMock.getSetpoint.mockResolvedValue(TEMPERATURE);

    const result = await controller.getTemperature(UNIT_ID, ZONE_1);

    logResult('getTemperature', result, TEMPERATURE);

    expect(serviceMock.getSetpoint).toHaveBeenCalledWith(UNIT_ID, ZONE_1);
    expect(result).toBe(TEMPERATURE);
  });

  it('should get virtual temperature through service', async () => {
    serviceMock.getVirtualTemperature.mockResolvedValue(VIRTUAL_TEMPERATURE);

    const result = await controller.getVirtualTemperature(UNIT_ID, ZONE_2);

    logResult('getVirtualTemperature', result, VIRTUAL_TEMPERATURE);

    expect(serviceMock.getVirtualTemperature).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_2,
    );
    expect(result).toBe(VIRTUAL_TEMPERATURE);
  });

  it('should set virtual temperature through service', async () => {
    await controller.setVirtualTemperature(
      UNIT_ID,
      ZONE_2,
      VIRTUAL_TEMPERATURE,
    );

    logResult(
      'setVirtualTemperature',
      [UNIT_ID, ZONE_2, VIRTUAL_TEMPERATURE],
      [UNIT_ID, ZONE_2, VIRTUAL_TEMPERATURE],
    );

    expect(serviceMock.setVirtualTemperature).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_2,
      VIRTUAL_TEMPERATURE,
    );
  });

  it('should get devices from repository', async () => {
    repositoryMock.getDevices.mockResolvedValue([DEVICE]);

    const result = await controller.getDevices();

    logResult('getDevices', result, [DEVICE]);

    expect(repositoryMock.getDevices).toHaveBeenCalled();
    expect(result).toEqual([DEVICE]);
  });

  it('should add device through repository', async () => {
    repositoryMock.addDevice.mockResolvedValue(DEVICE);

    const result = await controller.addDevice(DEVICE as any);

    logResult('addDevice', result, DEVICE);

    expect(repositoryMock.addDevice).toHaveBeenCalledWith(DEVICE);
    expect(result).toEqual(DEVICE);
  });

  it('should get device by id through repository', async () => {
    repositoryMock.getDeviceById.mockResolvedValue(DEVICE);

    const result = await controller.getDeviceById(DEVICE_ID);

    logResult('getDeviceById', result, DEVICE);

    expect(repositoryMock.getDeviceById).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toEqual(DEVICE);
  });

  it('should delete device through repository', async () => {
    repositoryMock.deleteDevice.mockResolvedValue(true);

    const result = await controller.deleteDevice(DEVICE_ID);

    logResult('deleteDevice', result, true);

    expect(repositoryMock.deleteDevice).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toBe(true);
  });

  it('should update device through repository', async () => {
    repositoryMock.updateDevice.mockResolvedValue(DEVICE);

    const result = await controller.updateDevice(DEVICE as any);

    logResult('updateDevice', result, DEVICE);

    expect(repositoryMock.updateDevice).toHaveBeenCalledWith(DEVICE);
    expect(result).toEqual(DEVICE);
  });

  it('should get fan speed through service', async () => {
    serviceMock.getFanSpeed.mockResolvedValue(FAN_SPEED);

    const result = await controller.getFanSpeed(UNIT_ID, ZONE_1);

    logResult('getFanSpeed', result, FAN_SPEED);

    expect(serviceMock.getFanSpeed).toHaveBeenCalledWith(UNIT_ID, ZONE_1);
    expect(result).toBe(FAN_SPEED);
  });

  it('should set fan speed through service', async () => {
    await controller.setFanSpeed(UNIT_ID, ZONE_1, FAN_SPEED);

    logResult(
      'setFanSpeed',
      [UNIT_ID, ZONE_1, FAN_SPEED],
      [UNIT_ID, ZONE_1, FAN_SPEED],
    );

    expect(serviceMock.setFanSpeed).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_1,
      FAN_SPEED,
    );
  });

  it('should get fan mode through service', async () => {
    serviceMock.getFanMode.mockResolvedValue(FAN_MODE);

    const result = await controller.getFanMode(UNIT_ID, ZONE_2);

    logResult('getFanMode', result, FAN_MODE);

    expect(serviceMock.getFanMode).toHaveBeenCalledWith(UNIT_ID, ZONE_2);
    expect(result).toBe(FAN_MODE);
  });

  it('should set fan mode through service', async () => {
    await controller.setFanMode(UNIT_ID, ZONE_2, FAN_MODE);

    logResult(
      'setFanMode',
      [UNIT_ID, ZONE_2, FAN_MODE],
      [UNIT_ID, ZONE_2, FAN_MODE],
    );

    expect(serviceMock.setFanMode).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_2,
      FAN_MODE,
    );
  });
});
