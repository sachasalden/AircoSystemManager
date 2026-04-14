import AircoController from '../../src/Airco/controllers/AircoController';
import AdapterRegistry from '../../src/Airco/adapters/AdapterRegistry';
import {
  AircoAdapter,
  AircoConnection,
  AircoZone,
} from '../../src/Airco/adapters/IAircoAdapter';
import { AircopanelRepository } from '../../src/Airco/repositories/WallpanelRepository';

jest.mock('../../src/Airco/repositories/WallpanelRepository', () => ({
  AircopanelRepository: jest.fn(),
}));

describe('AircoController', () => {
  const MONGO_URI = 'mongodb://test-db';
  const DEVICE_ID = 'device-1';
  const UNIT_ID = 7;
  const DB_UNIT_ID = 11;
  const ZONE_1 = 1 as AircoZone;
  const TEMPERATURE = 21.5;
  const FAN_SPEED = 3;
  const FAN_MODE = 2;

  const DEVICE = {
    _id: DEVICE_ID,
    deviceType: 'FC-500PC/FC-1100PC',
    data: {
      type: 'HeinAndHopmanIpSystem',
      deviceTerminalId: DB_UNIT_ID,
    },
    zoneId: 'zone-1',
    roomId: 'room-1',
  };

  let controller: AircoController;
  let registry: jest.Mocked<AdapterRegistry>;
  let repositoryMock: {
    getAircoDevices: jest.Mock;
    addAircoDevice: jest.Mock;
    getAircoDeviceById: jest.Mock;
    deleteAircoDevice: jest.Mock;
    updateAircoDevice: jest.Mock;
  };
  let adapterMock: jest.Mocked<AircoAdapter>;

  beforeEach(() => {
    repositoryMock = {
      getAircoDevices: jest.fn(),
      addAircoDevice: jest.fn(),
      getAircoDeviceById: jest.fn(),
      deleteAircoDevice: jest.fn(),
      updateAircoDevice: jest.fn(),
    };

    (AircopanelRepository as unknown as jest.Mock).mockImplementation(
      () => repositoryMock,
    );

    adapterMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getSetpoint: jest.fn(),
      setSetpoint: jest.fn(),
      getVirtualTemperature: jest.fn(),
      setVirtualTemperature: jest.fn(),
      getFanSpeed: jest.fn(),
      setFanSpeed: jest.fn(),
      getFanMode: jest.fn(),
      setFanMode: jest.fn(),
    };

    registry = {
      register: jest.fn(),
      create: jest.fn().mockReturnValue(adapterMock),
      has: jest.fn(),
    } as unknown as jest.Mocked<AdapterRegistry>;

    controller = new AircoController(registry, MONGO_URI);
  });

  it('should get devices from repository', async () => {
    repositoryMock.getAircoDevices.mockResolvedValue([DEVICE]);

    const result = await controller.getDevices();

    expect(repositoryMock.getAircoDevices).toHaveBeenCalled();
    expect(result).toEqual([DEVICE]);
  });

  it('should add device through repository', async () => {
    repositoryMock.addAircoDevice.mockResolvedValue(DEVICE);

    const result = await controller.addDevice({
      ...DEVICE,
      zoneId: 'zone-1',
      roomId: 'room-1',
    });

    expect(repositoryMock.addAircoDevice).toHaveBeenCalledWith({
      ...DEVICE,
      zoneId: 'zone-1',
      roomId: 'room-1',
    });
    expect(result).toEqual(DEVICE);
  });

  it('should get device by id through repository', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);

    const result = await controller.getDeviceById(DEVICE_ID);

    expect(repositoryMock.getAircoDeviceById).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toEqual(DEVICE);
  });

  it('should delete device through repository', async () => {
    repositoryMock.deleteAircoDevice.mockResolvedValue(true);

    const result = await controller.deleteDevice(DEVICE_ID);

    expect(repositoryMock.deleteAircoDevice).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toBe(true);
  });

  it('should update device through repository', async () => {
    repositoryMock.updateAircoDevice.mockResolvedValue(DEVICE);

    const result = await controller.updateDevice(DEVICE);

    expect(repositoryMock.updateAircoDevice).toHaveBeenCalledWith(DEVICE);
    expect(result).toEqual(DEVICE);
  });

  it('should get setpoint using adapter and requested unit id', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.getSetpoint.mockResolvedValue(TEMPERATURE);

    const result = await controller.getSetpoint(DEVICE_ID, UNIT_ID, ZONE_1);

    const expectedConnection: AircoConnection = {
      host: '192.168.55.10',
      port: 502,
      type: 'HeinAndHopmanIpSystem',
      model: 'FC-500PC/FC-1100PC',
    };

    expect(registry.create).toHaveBeenCalledWith(
      'HeinAndHopmanIpSystem',
      expectedConnection,
    );
    expect(adapterMock.connect).toHaveBeenCalled();
    expect(adapterMock.getSetpoint).toHaveBeenCalledWith(UNIT_ID, ZONE_1);
    expect(adapterMock.disconnect).toHaveBeenCalled();
    expect(result).toBe(TEMPERATURE);
  });

  it('should use deviceTerminalId when requested unit id is not finite', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.getSetpoint.mockResolvedValue(TEMPERATURE);

    const result = await controller.getSetpoint(
      DEVICE_ID,
      undefined as unknown as number,
      ZONE_1,
    );

    expect(adapterMock.getSetpoint).toHaveBeenCalledWith(DB_UNIT_ID, ZONE_1);
    expect(result).toBe(TEMPERATURE);
  });

  it('should set setpoint', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.setSetpoint.mockResolvedValue(undefined);

    await controller.setSetpoint(DEVICE_ID, UNIT_ID, ZONE_1, TEMPERATURE);

    expect(adapterMock.connect).toHaveBeenCalled();
    expect(adapterMock.setSetpoint).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_1,
      TEMPERATURE,
    );
    expect(adapterMock.disconnect).toHaveBeenCalled();
  });

  it('should get virtual temperature', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.getVirtualTemperature.mockResolvedValue(TEMPERATURE);

    const result = await controller.getVirtualTemperature(
      DEVICE_ID,
      UNIT_ID,
      ZONE_1,
    );

    expect(adapterMock.getVirtualTemperature).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_1,
    );
    expect(result).toBe(TEMPERATURE);
  });

  it('should set virtual temperature', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.setVirtualTemperature.mockResolvedValue(undefined);

    await controller.setVirtualTemperature(
      DEVICE_ID,
      UNIT_ID,
      ZONE_1,
      TEMPERATURE,
    );

    expect(adapterMock.setVirtualTemperature).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_1,
      TEMPERATURE,
    );
  });

  it('should get fan speed', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.getFanSpeed.mockResolvedValue(FAN_SPEED);

    const result = await controller.getFanSpeed(DEVICE_ID, UNIT_ID, ZONE_1);

    expect(adapterMock.getFanSpeed).toHaveBeenCalledWith(UNIT_ID, ZONE_1);
    expect(result).toBe(FAN_SPEED);
  });

  it('should set fan speed', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.setFanSpeed.mockResolvedValue(undefined);

    await controller.setFanSpeed(DEVICE_ID, UNIT_ID, ZONE_1, FAN_SPEED);

    expect(adapterMock.setFanSpeed).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_1,
      FAN_SPEED,
    );
  });

  it('should get fan mode', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.getFanMode.mockResolvedValue(FAN_MODE);

    const result = await controller.getFanMode(DEVICE_ID, UNIT_ID, ZONE_1);

    expect(adapterMock.getFanMode).toHaveBeenCalledWith(UNIT_ID, ZONE_1);
    expect(result).toBe(FAN_MODE);
  });

  it('should set fan mode', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.setFanMode.mockResolvedValue(undefined);

    await controller.setFanMode(DEVICE_ID, UNIT_ID, ZONE_1, FAN_MODE);

    expect(adapterMock.setFanMode).toHaveBeenCalledWith(
      UNIT_ID,
      ZONE_1,
      FAN_MODE,
    );
  });

  it('should throw when device is not found', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(null);

    await expect(
      controller.getSetpoint(DEVICE_ID, UNIT_ID, ZONE_1),
    ).rejects.toThrow('Device not found');

    expect(registry.create).not.toHaveBeenCalled();
  });

  it('should throw when device type is missing', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue({
      ...DEVICE,
      data: {
        ...DEVICE.data,
        type: undefined,
      },
    });

    await expect(
      controller.getSetpoint(DEVICE_ID, UNIT_ID, ZONE_1),
    ).rejects.toThrow('Airco device missing data.type');

    expect(registry.create).not.toHaveBeenCalled();
  });

  it('should throw when deviceTerminalId is invalid and no requested unit id is given', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue({
      ...DEVICE,
      data: {
        ...DEVICE.data,
        deviceTerminalId: undefined,
      },
    });

    await expect(
      controller.getSetpoint(DEVICE_ID, undefined as unknown as number, ZONE_1),
    ).rejects.toThrow('Airco device missing valid data.deviceTerminalId');
  });

  it('should always disconnect when adapter action fails', async () => {
    repositoryMock.getAircoDeviceById.mockResolvedValue(DEVICE);
    adapterMock.getSetpoint.mockRejectedValue(new Error('adapter failed'));

    await expect(
      controller.getSetpoint(DEVICE_ID, UNIT_ID, ZONE_1),
    ).rejects.toThrow('adapter failed');

    expect(adapterMock.connect).toHaveBeenCalled();
    expect(adapterMock.disconnect).toHaveBeenCalled();
  });
});
