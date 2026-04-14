import {
  EnvironmentDevice,
  EnvironmentDeviceRepository,
} from '../repositories/EnvironmentDeviceRepository';

export class EnvironmentDeviceService {
  constructor(private readonly repository: EnvironmentDeviceRepository) {}

  async getDevices(): Promise<EnvironmentDevice[]> {
    return this.repository.getDevices();
  }

  async getDeviceById(id: string): Promise<EnvironmentDevice | null> {
    return this.repository.getDeviceById(id);
  }

  async addDevice(
    device: Partial<EnvironmentDevice>,
  ): Promise<EnvironmentDevice> {
    if (!device.type) {
      throw new Error('Type is required');
    }

    if (!device.name) {
      throw new Error('Name is required');
    }

    return this.repository.addDevice(device);
  }

  async updateDevice(
    id: string,
    device: Partial<EnvironmentDevice>,
  ): Promise<EnvironmentDevice | null> {
    return this.repository.updateDevice(id, device);
  }

  async deleteDevice(id: string): Promise<string | null> {
    return this.repository.deleteDevice(id);
  }
}
