import { EnvironmentDeviceController } from '../../src/Airco/controllers/EnvironmentDeviceController';
import { EnvironmentDeviceService } from '../../src/Airco/services/EnvironmentDeviceService';
import { EnvironmentDevice } from '../../src/Airco/repositories/EnvironmentDeviceRepository';

const DEVICE_ID = 'environment-device-1';
const DEVICE_NAME = 'Environment Device';
const DEVICE_TYPE = 'HeinAndHopmanIpSystem';
const DEVICE_IP = '192.168.55.20';
const DEVICE_PORT = '4001';
const BIDIRECTIONAL = true;

describe('EnvironmentDeviceController', () => {
  let service: jest.Mocked<EnvironmentDeviceService>;
  let controller: EnvironmentDeviceController;

  const createDevice = (): EnvironmentDevice => ({
    id: DEVICE_ID,
    name: DEVICE_NAME,
    type: DEVICE_TYPE,
    ip: DEVICE_IP,
    port: DEVICE_PORT,
    bidirectional: BIDIRECTIONAL,
  });

  beforeEach(() => {
    service = {
      getDevices: jest.fn(),
      getDeviceById: jest.fn(),
      addDevice: jest.fn(),
      updateDevice: jest.fn(),
      deleteDevice: jest.fn(),
    } as unknown as jest.Mocked<EnvironmentDeviceService>;

    controller = new EnvironmentDeviceController(service);
  });

  it('should get devices', async () => {
    const devices = [createDevice()];
    service.getDevices.mockResolvedValue(devices);

    const result = await controller.getDevices();

    expect(service.getDevices).toHaveBeenCalled();
    expect(result).toBe(devices);
  });

  it('should get device by id', async () => {
    const device = createDevice();
    service.getDeviceById.mockResolvedValue(device);

    const result = await controller.getDeviceById(DEVICE_ID);

    expect(service.getDeviceById).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toBe(device);
  });

  it('should add device', async () => {
    const device = createDevice();
    service.addDevice.mockResolvedValue(device);

    const result = await controller.addDevice(device);

    expect(service.addDevice).toHaveBeenCalledWith(device);
    expect(result).toBe(device);
  });

  it('should update device', async () => {
    const update = {
      name: DEVICE_NAME,
      ip: DEVICE_IP,
    };

    const updatedDevice = createDevice();
    service.updateDevice.mockResolvedValue(updatedDevice);

    const result = await controller.updateDevice(DEVICE_ID, update);

    expect(service.updateDevice).toHaveBeenCalledWith(DEVICE_ID, update);
    expect(result).toBe(updatedDevice);
  });

  it('should delete device', async () => {
    service.deleteDevice.mockResolvedValue(DEVICE_ID);

    const result = await controller.deleteDevice(DEVICE_ID);

    expect(service.deleteDevice).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toBe(DEVICE_ID);
  });
});
