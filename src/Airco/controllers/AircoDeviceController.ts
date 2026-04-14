import {
  AircopanelRepository,
  AirconditionerDevice,
} from '../repositories/WallpanelRepository';

export default class AircoDeviceController {
  constructor(private repository: AircopanelRepository) {}

  async getDevices() {
    return this.repository.getAircoDevices();
  }

  async addDevice(
    device: AirconditionerDevice & { zoneId: string; roomId: string },
  ) {
    return this.repository.addAircoDevice(device);
  }

  async getDeviceById(deviceId: string) {
    return this.repository.getAircoDeviceById(deviceId);
  }

  async deleteDevice(deviceId: string) {
    return this.repository.deleteAircoDevice(deviceId);
  }

  async updateDevice(device: AirconditionerDevice) {
    return this.repository.updateAircoDevice(device);
  }
}
