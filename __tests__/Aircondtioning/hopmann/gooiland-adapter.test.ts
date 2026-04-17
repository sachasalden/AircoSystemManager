import HeinEnHopmanGooilandAdapter from '../../../src/Airco/adapters/hopmann/HeinEnHopmanGooilandAdapter';
import type {
  AircoConnection,
  AircoZone,
} from '../../../src/Airco/adapters/IAircoAdapter';

describe('HeinEnHopmanGooilandAdapter', () => {
  const unitId = 1;
  const zone = 1 as AircoZone;

  const connection: AircoConnection = {
    host: '192.168.55.10',
    port: 502,
    bidirectional: true,
    roomTemparatureAddress: '40011',
    roomTemparatureSetPointAddress: '40012',
    fanspeedAddress: '40013',
    fanspeedSetPointAddress: '40014',
  };

  let adapter: HeinEnHopmanGooilandAdapter;
  let getRegisterSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new HeinEnHopmanGooilandAdapter(connection);
    getRegisterSpy = jest.spyOn(adapter as any, 'getRegister');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should connect and disconnect without opening a persistent socket', async () => {
    await expect(adapter.connect()).resolves.toBeUndefined();
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });

  it('should read setpoint from the configured holding register', async () => {
    getRegisterSpy.mockResolvedValue(215);

    const result = await adapter.getSetpoint(unitId, zone);

    expect(result).toBe(21.5);
    expect(getRegisterSpy).toHaveBeenCalledWith(unitId, 12, 'readHold', 1);
  });

  it('should write setpoint to the configured holding register', async () => {
    getRegisterSpy.mockResolvedValue(undefined);

    await adapter.setSetpoint(unitId, zone, 22.5);

    expect(getRegisterSpy).toHaveBeenCalledWith(unitId, 12, 'writeSingle', 225);
  });

  it('should read virtual temperature from room temperature when bidirectional', async () => {
    getRegisterSpy.mockResolvedValue(203);

    const result = await adapter.getVirtualTemperature(unitId, zone);

    expect(result).toBe(20.3);
    expect(getRegisterSpy).toHaveBeenCalledWith(unitId, 11, 'readHold', 1);
  });

  it('should mirror setpoint as virtual temperature when not bidirectional', async () => {
    adapter = new HeinEnHopmanGooilandAdapter({
      ...connection,
      bidirectional: false,
    });
    jest.spyOn(adapter, 'getSetpoint').mockResolvedValue(19.5);

    const result = await adapter.getVirtualTemperature(unitId, zone);

    expect(result).toBe(19.5);
    expect(adapter.getSetpoint).toHaveBeenCalledWith(unitId, zone);
  });

  it('should read fan speed from the configured holding register', async () => {
    getRegisterSpy.mockResolvedValue(30);

    const result = await adapter.getFanSpeed(unitId, zone);

    expect(result).toBe(3);
    expect(getRegisterSpy).toHaveBeenCalledWith(unitId, 13, 'readHold', 1);
  });

  it('should return -1 when fan speed address is not configured', async () => {
    adapter = new HeinEnHopmanGooilandAdapter({
      ...connection,
      fanspeedAddress: '',
    });

    await expect(adapter.getFanSpeed(unitId, zone)).resolves.toBe(-1);
  });

  it('should write fan speed and fan mode through the fan setpoint address', async () => {
    getRegisterSpy.mockResolvedValue(undefined);

    await adapter.setFanSpeed(unitId, zone, 4);
    await adapter.setFanMode(unitId, zone, 2);

    expect(getRegisterSpy).toHaveBeenNthCalledWith(
      1,
      unitId,
      14,
      'writeSingle',
      40,
    );
    expect(getRegisterSpy).toHaveBeenNthCalledWith(
      2,
      unitId,
      14,
      'writeSingle',
      20,
    );
  });

  it('should throw when a required register address is missing', async () => {
    adapter = new HeinEnHopmanGooilandAdapter({
      ...connection,
      roomTemparatureSetPointAddress: '',
    });

    await expect(adapter.getSetpoint(unitId, zone)).rejects.toThrow(
      'Gooiland adapter missing roomTemparatureSetPointAddress',
    );
  });
});
