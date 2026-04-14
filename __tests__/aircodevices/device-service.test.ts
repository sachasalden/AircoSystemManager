import DeviceService from '../../src/Airco/services/DeviceService';
import { AircopanelRepository } from '../../src/Airco/repositories/WallpanelRepository';

const ZONE_ID = 'zone-1';
const ZONE_NAME = 'Begane grond';

const ROOM_ID = 'room-1';
const ROOM_NAME = 'Woonkamer';

const AIRCO_PANEL_ID = 'panel-1';
const AIRCONDITIONER_ID = 'airco-1';

describe('DeviceService', () => {
  let repository: jest.Mocked<AircopanelRepository>;
  let service: DeviceService;

  beforeEach(() => {
    repository = {
      getZones: jest.fn(),
    } as unknown as jest.Mocked<AircopanelRepository>;

    service = new DeviceService(repository);
  });

  it('should get device tree', async () => {
    const zones = [
      {
        _id: {
          toString: jest.fn().mockReturnValue(ZONE_ID),
        },
        name: ZONE_NAME,
        rooms: [
          {
            id: ROOM_ID,
            name: ROOM_NAME,
            aircopanels: [AIRCO_PANEL_ID],
            airconditioners: [AIRCONDITIONER_ID],
          },
        ],
      },
    ];

    repository.getZones.mockResolvedValue(zones as never);

    const result = await service.getDeviceTree();

    expect(repository.getZones).toHaveBeenCalled();

    expect(result).toEqual([
      {
        id: ZONE_ID,
        name: ZONE_NAME,
        rooms: [
          {
            id: ROOM_ID,
            name: ROOM_NAME,
            aircopanels: [AIRCO_PANEL_ID],
            airconditioners: [AIRCONDITIONER_ID],
          },
        ],
      },
    ]);
  });

  it('should return empty rooms when zone has no rooms', async () => {
    const zones = [
      {
        _id: {
          toString: jest.fn().mockReturnValue(ZONE_ID),
        },
        name: ZONE_NAME,
        rooms: undefined,
      },
    ];

    repository.getZones.mockResolvedValue(zones as never);

    const result = await service.getDeviceTree();

    expect(result).toEqual([
      {
        id: ZONE_ID,
        name: ZONE_NAME,
        rooms: [],
      },
    ]);
  });

  it('should return empty device arrays when room has no devices', async () => {
    const zones = [
      {
        _id: {
          toString: jest.fn().mockReturnValue(ZONE_ID),
        },
        name: ZONE_NAME,
        rooms: [
          {
            id: ROOM_ID,
            name: ROOM_NAME,
            aircopanels: undefined,
            airconditioners: undefined,
          },
        ],
      },
    ];

    repository.getZones.mockResolvedValue(zones as never);

    const result = await service.getDeviceTree();

    expect(result).toEqual([
      {
        id: ZONE_ID,
        name: ZONE_NAME,
        rooms: [
          {
            id: ROOM_ID,
            name: ROOM_NAME,
            aircopanels: [],
            airconditioners: [],
          },
        ],
      },
    ]);
  });
});
