import TopologyService from '../src/Airco/services/TopologyService';
import { AircopanelRepository } from '../src/Airco/repositories/WallpanelRepository';
import { EnvironmentDeviceRepository } from '../src/Airco/repositories/EnvironmentDeviceRepository';

describe('TopologyService', () => {
  const TEST_ZONE_ID = 'zone-1';
  const TEST_ROOM_ID = 'room-1';

  let repository: jest.Mocked<AircopanelRepository>;
  let environmentDeviceRepository: jest.Mocked<EnvironmentDeviceRepository>;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      TEST_ZONE_ID,
      TEST_ROOM_ID,
    };

    repository = {
      getZones: jest.fn(),
      getDevices: jest.fn(),
      getAircoDevices: jest.fn(),
    } as unknown as jest.Mocked<AircopanelRepository>;

    environmentDeviceRepository = {
      getDevices: jest.fn(),
    } as unknown as jest.Mocked<EnvironmentDeviceRepository>;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return only the selected room with mapped panels and aircos', async () => {
    repository.getZones.mockResolvedValue([
      {
        _id: ' zone-1 ',
        name: 'Zone A',
        rooms: [
          { id: ' room-1 ', name: 'Room One' },
          { id: 'room-2', name: 'Room Two' },
        ],
      },
      {
        _id: 'zone-2',
        name: 'Zone B',
        rooms: [{ id: 'room-1', name: 'Other Room' }],
      },
    ] as any);

    repository.getDevices.mockResolvedValue([
      {
        id: 'panel-1',
        ip: '192.168.1.10',
        port: 502,
        ids: ['1', '2', 'abc', 3],
        type: 'panelType',
        zoneId: 'zone-1',
        roomId: 'room-1',
      },
      {
        id: 'panel-2',
        ip: '192.168.1.11',
        port: 503,
        ids: [4],
        type: 'panelType',
        zoneId: 'zone-1',
        roomId: 'room-2',
      },
    ] as any);

    repository.getAircoDevices.mockResolvedValue([
      {
        id: 'airco-1',
        deviceType: 'FC-500PC/FC-1100PC',
        data: {
          deviceId: 'environment-device-1',
          type: 'HeinAndHopmanIpSystem',
        },
        zoneId: 'zone-1',
        roomId: 'room-1',
      },
      {
        id: 'airco-2',
        deviceType: 'OtherType',
        data: { type: 'Other' },
        zoneId: 'zone-2',
        roomId: 'room-1',
      },
    ] as any);

    environmentDeviceRepository.getDevices.mockResolvedValue([
      {
        id: 'environment-device-1',
        name: 'DEV Server emulator',
        type: 'HeinAndHopmanIpSystem',
        ip: '192.168.55.10',
        port: '502',
        bidirectional: true,
      },
    ]);

    const service = new TopologyService(repository, environmentDeviceRepository);
    const result = await service.getRooms();

    console.log('TopologyService result:', JSON.stringify(result, null, 2));

    expect(result).toEqual([
      {
        zoneId: 'zone-1',
        roomId: 'room-1',
        roomName: 'Room One',
        panels: [
          {
            id: 'panel-1',
            ip: '192.168.1.10',
            port: 502,
            ids: [1, 2, 3],
            type: 'panelType',
          },
        ],
        aircos: [
          {
            id: 'airco-1',
            deviceType: 'FC-500PC/FC-1100PC',
            data: {
              deviceId: 'environment-device-1',
              type: 'HeinAndHopmanIpSystem',
            },
            environmentDevice: {
              id: 'environment-device-1',
              name: 'DEV Server emulator',
              type: 'HeinAndHopmanIpSystem',
              ip: '192.168.55.10',
              port: 502,
              bidirectional: true,
            },
          },
        ],
      },
    ]);
  });

  it('should return an empty array when no zone or room matches', async () => {
    repository.getZones.mockResolvedValue([
      {
        _id: 'zone-x',
        name: 'Zone X',
        rooms: [{ id: 'room-x', name: 'Room X' }],
      },
    ] as any);

    repository.getDevices.mockResolvedValue([] as any);
    repository.getAircoDevices.mockResolvedValue([] as any);
    environmentDeviceRepository.getDevices.mockResolvedValue([]);

    const service = new TopologyService(repository, environmentDeviceRepository);
    const result = await service.getRooms();

    console.log('TopologyService empty result:', result);

    expect(result).toEqual([]);
  });

  it('should handle zones without rooms', async () => {
    repository.getZones.mockResolvedValue([
      {
        _id: 'zone-1',
        name: 'Zone A',
      },
    ] as any);

    repository.getDevices.mockResolvedValue([] as any);
    repository.getAircoDevices.mockResolvedValue([] as any);
    environmentDeviceRepository.getDevices.mockResolvedValue([]);

    const service = new TopologyService(repository, environmentDeviceRepository);
    const result = await service.getRooms();

    console.log('TopologyService no rooms result:', result);

    expect(result).toEqual([]);
  });

  it('should use default ids when env vars are not set', async () => {
    process.env = { ...originalEnv };
    delete process.env.TEST_ZONE_ID;
    delete process.env.TEST_ROOM_ID;

    const defaultZoneId = '691ee9f917ddcc79daf9fe84';
    const defaultRoomId = '2134af85-4377-2330-af2d-72143bec6574';

    repository.getZones.mockResolvedValue([
      {
        _id: defaultZoneId,
        name: 'Default Zone',
        rooms: [{ id: defaultRoomId, name: 'Default Room' }],
      },
    ] as any);

    repository.getDevices.mockResolvedValue([] as any);
    repository.getAircoDevices.mockResolvedValue([] as any);
    environmentDeviceRepository.getDevices.mockResolvedValue([]);

    const service = new TopologyService(repository, environmentDeviceRepository);
    const result = await service.getRooms();

    console.log('TopologyService default env result:', result);

    expect(result).toEqual([
      {
        zoneId: defaultZoneId,
        roomId: defaultRoomId,
        roomName: 'Default Room',
        panels: [],
        aircos: [],
      },
    ]);
  });
});
