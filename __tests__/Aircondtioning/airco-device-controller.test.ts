import AircoDeviceController from '../../src/Airco/controllers/AircoDeviceController';
import {
  AircopanelRepository,
  AirconditionerDevice,
} from '../../src/Airco/repositories/WallpanelRepository';

const DEVICE_ID = 'airco-device-1';
const ZONE_ID = 'zone-1';
const ROOM_ID = 'room-1';
const DEVICE_TYPE = 'polarbear';

describe('AircoDeviceController', () => {
  let repository: jest.Mocked<AircopanelRepository>;
  let controller: AircoDeviceController;

  const createDevice = (): AirconditionerDevice & {
    zoneId: string;
    roomId: string;
  } =>
    ({
      id: DEVICE_ID,
      deviceType: DEVICE_TYPE,
      zoneId: ZONE_ID,
      roomId: ROOM_ID,
      data: {},
    }) as unknown as AirconditionerDevice & {
      zoneId: string;
      roomId: string;
    };

  beforeEach(() => {
    repository = {
      getAircoDevices: jest.fn(),
      addAircoDevice: jest.fn(),
      getAircoDeviceById: jest.fn(),
      deleteAircoDevice: jest.fn(),
      updateAircoDevice: jest.fn(),
    } as unknown as jest.Mocked<AircopanelRepository>;

    controller = new AircoDeviceController(repository);
  });

  it('should get devices', async () => {
    const devices = [createDevice()];
    repository.getAircoDevices.mockResolvedValue(devices);

    const result = await controller.getDevices();

    expect(repository.getAircoDevices).toHaveBeenCalled();
    expect(result).toBe(devices);
  });

  it('should add device', async () => {
    const device = createDevice();
    repository.addAircoDevice.mockResolvedValue(device);

    const result = await controller.addDevice(device);

    expect(repository.addAircoDevice).toHaveBeenCalledWith(device);
    expect(result).toBe(device);
  });

  it('should get device by id', async () => {
    const device = createDevice();
    repository.getAircoDeviceById.mockResolvedValue(device);

    const result = await controller.getDeviceById(DEVICE_ID);

    expect(repository.getAircoDeviceById).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toBe(device);
  });

  it('should delete device', async () => {
    const deleteResult = true;
    repository.deleteAircoDevice.mockResolvedValue(deleteResult);

    const result = await controller.deleteDevice(DEVICE_ID);

    expect(repository.deleteAircoDevice).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toBe(deleteResult);
  });

  it('should update device', async () => {
    const device = createDevice();
    repository.updateAircoDevice.mockResolvedValue(device);

    const result = await controller.updateDevice(device);

    expect(repository.updateAircoDevice).toHaveBeenCalledWith(device);
    expect(result).toBe(device);
  });
});
