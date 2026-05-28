import {
  AircopanelRepository,
  type AirconditionerDevice,
  type Device,
} from '../repositories/WallpanelRepository';
import {
  EnvironmentDeviceRepository,
  type EnvironmentDevice,
} from '../repositories/EnvironmentDeviceRepository';
import type { TopologyRoom } from './SyncTypes';

type ZoneDoc = {
  _id: unknown;
  name: string;
  rooms?: Array<{
    id: string;
    name: string;
  }>;
};

type PanelDevice = Device & {
  zoneId: string;
  roomId: string;
};

type AircoDevice = AirconditionerDevice & {
  zoneId: string;
  roomId: string;
};

export default class TopologyService {
  private readonly testZoneId = process.env.TEST_ZONE_ID?.trim() || '691ee9f917ddcc79daf9fe84';
  private readonly testRoomId = process.env.TEST_ROOM_ID?.trim() || '2134af85-4377-2330-af2d-72143bec6574';

  constructor(
    private repository: AircopanelRepository,
    private environmentDeviceRepository: EnvironmentDeviceRepository,
  ) {}

  async getRooms(): Promise<TopologyRoom[]> {
    const [zones, panels, aircos, environmentDevices] = await Promise.all([
      this.repository.getZones() as Promise<ZoneDoc[]>,
      this.repository.getDevices() as Promise<PanelDevice[]>,
      this.repository.getAircoDevices() as Promise<AircoDevice[]>,
      this.environmentDeviceRepository.getDevices() as Promise<EnvironmentDevice[]>,
    ]);

    const rooms = zones.flatMap((zone) =>
      (zone.rooms || [])
        .filter((room) => this.isSelectedRoom(zone, room.id))
        .map((room) => this.toTopologyRoom(zone, room, panels, aircos, environmentDevices)),
    );

    console.log(
      '[TopologyService] selected rooms =',
      rooms.map((room) => ({
        zoneId: room.zoneId,
        roomId: room.roomId,
        roomName: room.roomName,
        panelCount: room.panels.length,
        aircoCount: room.aircos.length,
      })),
    );

    return rooms;
  }

  private toTopologyRoom(
    zone: ZoneDoc,
    room: { id: string; name: string },
    panels: PanelDevice[],
    aircos: AircoDevice[],
    environmentDevices: EnvironmentDevice[],
  ): TopologyRoom {
    const zoneId = this.cleanId(zone._id);
    const roomId = this.cleanId(room.id);

    return {
      zoneId,
      roomId,
      roomName: room.name,
      panels: panels
        .filter((panel) => this.isInRoom(panel, zoneId, roomId))
        .map((panel) => ({
          id: panel.id,
          ip: panel.ip,
          port: panel.port,
          ids: this.normalizeIds(panel.ids),
          modbusUnits: Array.isArray(panel.modbusUnits)
            ? panel.modbusUnits.map((unit) => ({
                id: Number(unit.id),
                name: unit.name,
                type: unit.type,
                zones: unit.zones,
              }))
            : undefined,
          type: panel.type,
        })),
      aircos: aircos
        .filter((airco) => this.isInRoom(airco, zoneId, roomId))
        .map((airco) => ({
          id: airco.id,
          deviceType: airco.deviceType,
          setTemperature: airco.setTemperature,
          currentTemperature: airco.currentTemperature,
          data: airco.data,
          environmentDevice: this.findEnvironmentDevice(
            airco.data?.deviceId,
            environmentDevices,
          ),
        })),
    };
  }

  private isSelectedRoom(zone: ZoneDoc, roomId: string): boolean {
    return (
      this.cleanId(zone._id) === this.testZoneId &&
      this.cleanId(roomId) === this.testRoomId
    );
  }

  private isInRoom(
    device: { zoneId?: unknown; roomId?: unknown },
    zoneId: string,
    roomId: string,
  ): boolean {
    return (
      this.cleanId(device.zoneId) === zoneId &&
      this.cleanId(device.roomId) === roomId
    );
  }

  private findEnvironmentDevice(
    deviceId: unknown,
    environmentDevices: EnvironmentDevice[],
  ): TopologyRoom['aircos'][number]['environmentDevice'] {
    const device = environmentDevices.find(
      (environmentDevice) => environmentDevice.id === deviceId,
    );

    if (!device) {
      return undefined;
    }

    return {
      id: device.id,
      name: device.name,
      type: device.type,
      ip: device.ip,
      port: Number(device.port),
      bidirectional: device.bidirectional,
    };
  }

  private cleanId(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeIds(ids?: unknown[]): number[] {
    return [...new Set((ids || []).map(Number))]
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }
}
