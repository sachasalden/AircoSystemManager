import { AircopanelRepository } from '../repositories/WallpanelRepository';

export default class DeviceService {
  constructor(private repository: AircopanelRepository) {}

  async getDeviceTree() {
    const zones = await this.repository.getZones();

    return zones.map((zone) => ({
      id: zone._id.toString(),
      name: zone.name,
      rooms: (zone.rooms || []).map((room) => ({
        id: room.id,
        name: room.name,
        aircopanels: room.aircopanels || [],
        airconditioners: room.airconditioners || [],
      })),
    }));
  }
}
