import {
  AircopanelRepository,
  type Device,
  type AirconditionerDevice,
} from '../repositories/WallpanelRepository';
import type { TopologyRoom } from './SyncTypes';

type ZoneDoc = {
  _id: any;
  name: string;
  rooms?: Array<{
    id: string;
    name: string;
  }>;
};

export default class TopologyService {
  private readonly TEST_ZONE_ID =
    process.env.TEST_ZONE_ID?.trim() || '691ee9f917ddcc79daf9fe84';

  private readonly TEST_ROOM_ID =
    process.env.TEST_ROOM_ID?.trim() || '2134af85-4377-2330-af2d-72143bec6574';

  constructor(private repository: AircopanelRepository) {}

  async getRooms(): Promise<TopologyRoom[]> {
    console.log('[TopologyService] TEST_ZONE_ID =', this.TEST_ZONE_ID);
    console.log('[TopologyService] TEST_ROOM_ID =', this.TEST_ROOM_ID);

    const [zones, panels, aircos] = await Promise.all([
      this.repository.getZones() as Promise<ZoneDoc[]>,
      this.repository.getDevices() as Promise<
        (Device & {
          zoneId: string;
          roomId: string;
        })[]
      >,
      this.repository.getAircoDevices() as Promise<
        (AirconditionerDevice & {
          zoneId: string;
          roomId: string;
        })[]
      >,
    ]);

    const rooms: TopologyRoom[] = [];

    for (const zone of zones) {
      const zoneId = zone._id.toString().trim();

      if (zoneId !== this.TEST_ZONE_ID) {
        continue;
      }

      for (const room of zone.rooms || []) {
        const roomId = room.id.trim();

        if (roomId !== this.TEST_ROOM_ID) {
          continue;
        }

        const roomPanels = panels
          .filter(
            (d) =>
              d.zoneId?.toString().trim() === zoneId &&
              d.roomId?.toString().trim() === roomId,
          )
          .map((d) => ({
            id: d.id,
            ip: d.ip,
            port: d.port,
            ids: (d.ids || []).map(Number).filter(Number.isFinite),
            type: d.type,
          }));

        const roomAircos = aircos
          .filter(
            (d) =>
              d.zoneId?.toString().trim() === zoneId &&
              d.roomId?.toString().trim() === roomId,
          )
          .map((d) => ({
            id: d.id,
            deviceType: d.deviceType,
            data: d.data,
          }));

        rooms.push({
          zoneId,
          roomId,
          roomName: room.name,
          panels: roomPanels,
          aircos: roomAircos,
        });
      }
    }

    console.log(
      '[TopologyService] selected rooms =',
      rooms.map((r) => ({
        zoneId: r.zoneId,
        roomId: r.roomId,
        roomName: r.roomName,
        panelCount: r.panels.length,
        aircoCount: r.aircos.length,
      })),
    );

    return rooms;
  }
}
