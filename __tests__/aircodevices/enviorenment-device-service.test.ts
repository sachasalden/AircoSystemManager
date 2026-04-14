import {
  EnvironmentDevice,
  EnvironmentDeviceRepository,
} from '../../src/Airco/repositories/EnvironmentDeviceRepository';
import { EnvironmentDeviceService } from '../../src/Airco/services/EnvironmentDeviceService';

const DEVICE_ID = 'environment-device-1';
const DEVICE_NAME = 'Environment Device';
const DEVICE_TYPE = 'HeinAndHopmanIpSystem';
const DEVICE_IP = '192.168.55.20';
const DEVICE_PORT = '4001';
const BIDIRECTIONAL = true;

describe('EnvironmentDeviceService', () => {
  let repository: jest.Mocked<EnvironmentDeviceRepository>;
  let service: EnvironmentDeviceService;

  const createDevice = (): EnvironmentDevice => ({
    id: DEVICE_ID,
    name: DEVICE_NAME,
    type: DEVICE_TYPE,
    ip: DEVICE_IP,
    port: DEVICE_PORT,
    bidirectional: BIDIRECTIONAL,
  });

  beforeEach(() => {
    repository = {
      getDevices: jest.fn(),
      getDeviceById: jest.fn(),
      addDevice: jest.fn(),
      updateDevice: jest.fn(),
      deleteDevice: jest.fn(),
    } as unknown as jest.Mocked<EnvironmentDeviceRepository>;

    service = new EnvironmentDeviceService(repository);
  });

  it('should get devices', async () => {
    const devices = [createDevice()];
    repository.getDevices.mockResolvedValue(devices);

    const result = await service.getDevices();

    expect(repository.getDevices).toHaveBeenCalled();
    expect(result).toBe(devices);
  });

  it('should get device by id', async () => {
    const device = createDevice();
    repository.getDeviceById.mockResolvedValue(device);

    const result = await service.getDeviceById(DEVICE_ID);

    expect(repository.getDeviceById).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toBe(device);
  });

  it('should add device', async () => {
    const device = createDevice();
    repository.addDevice.mockResolvedValue(device);

    const result = await service.addDevice(device);

    expect(repository.addDevice).toHaveBeenCalledWith(device);
    expect(result).toBe(device);
  });

  it('should throw when adding device without type', async () => {
    const device = {
      name: DEVICE_NAME,
    };

    await expect(service.addDevice(device)).rejects.toThrow('Type is required');

    expect(repository.addDevice).not.toHaveBeenCalled();
  });

  it('should throw when adding device without name', async () => {
    const device = {
      type: DEVICE_TYPE,
    };

    await expect(service.addDevice(device)).rejects.toThrow('Name is required');

    expect(repository.addDevice).not.toHaveBeenCalled();
  });

  it('should update device', async () => {
    const update = {
      name: DEVICE_NAME,
      ip: DEVICE_IP,
    };

    const updatedDevice = createDevice();
    repository.updateDevice.mockResolvedValue(updatedDevice);

    const result = await service.updateDevice(DEVICE_ID, update);

    expect(repository.updateDevice).toHaveBeenCalledWith(DEVICE_ID, update);
    expect(result).toBe(updatedDevice);
  });

  it('should delete device', async () => {
    repository.deleteDevice.mockResolvedValue(DEVICE_ID);

    const result = await service.deleteDevice(DEVICE_ID);

    expect(repository.deleteDevice).toHaveBeenCalledWith(DEVICE_ID);
    expect(result).toBe(DEVICE_ID);
  });
});
