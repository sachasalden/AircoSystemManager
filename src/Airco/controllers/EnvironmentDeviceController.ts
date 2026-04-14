import { EnvironmentDevice } from '../repositories/EnvironmentDeviceRepository.ts';
import { EnvironmentDeviceService } from '../services/EnvironmentDeviceService.ts';

export class EnvironmentDeviceController {
  constructor(private readonly service: EnvironmentDeviceService) {}

  async getDevices(): Promise<EnvironmentDevice[]> {
    return this.service.getDevices();
  }

  async getDeviceById(id: string): Promise<EnvironmentDevice | null> {
    return this.service.getDeviceById(id);
  }

  async addDevice(
    device: Partial<EnvironmentDevice>,
  ): Promise<EnvironmentDevice> {
    return this.service.addDevice(device);
  }

  async updateDevice(
    id: string,
    device: Partial<EnvironmentDevice>,
  ): Promise<EnvironmentDevice | null> {
    return this.service.updateDevice(id, device);
  }

  async deleteDevice(id: string): Promise<string | null> {
    return this.service.deleteDevice(id);
  }
}
