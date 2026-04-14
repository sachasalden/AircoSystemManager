import HopmannAdapter from '../../../src/Airco/adapters/hopmann/HopmannAdapter';
import {
  AircoConnection,
  AircoZone,
} from '../../../src/Airco/adapters/IAircoAdapter';

jest.setTimeout(30000);

describe('HopmannAdapter', () => {
  const unitId = 1;
  const zone = 1 as AircoZone;

  const connectionTypeA: AircoConnection = {
    host: '192.168.33.5',
    port: 300,
    type: 'FC-500PC/FC-1100PC',
  };

  const connectionTypeB: AircoConnection = {
    host: '192.168.33.6',
    port: 300,
    type: 'FC-3000DC/FC-3500DC',
  };

  const connectionUnknown: AircoConnection = {
    host: '192.168.33.7',
    port: 300,
    type: 'UNKNOWN',
  };

  let adapter: HopmannAdapter;
  let readOrWriteSpy: jest.SpyInstance;

  describe('Type A - FC-500PC/FC-1100PC', () => {
    beforeEach(() => {
      adapter = new HopmannAdapter(connectionTypeA);
      readOrWriteSpy = jest.spyOn(adapter as any, 'readOrWrite');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should connect successfully', async () => {
      await expect(adapter.connect()).resolves.toBeUndefined();
    });

    it('should disconnect successfully', async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });

    it('should read temperature setpoint', async () => {
      readOrWriteSpy.mockResolvedValue(205);

      const result = await adapter.getSetpoint(unitId, zone);

      expect(result).toBe(20.5);
      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 0, 'readInput', 1);
    });

    it('should write temperature setpoint', async () => {
      const setTemperature = 23.5;
      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setSetpoint(unitId, zone, setTemperature);

      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 0, 'writeHold', 235);
    });

    it('should read virtual temperature', async () => {
      readOrWriteSpy.mockResolvedValue(220);

      const result = await adapter.getVirtualTemperature(unitId, zone);
      const expectedVirtualTemperature = 22.0;

      expect(result).toBe(expectedVirtualTemperature);
      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 0, 'readInput', 1);
    });

    it('should write virtual temperature', async () => {
      const setVirtualTemperature = 21.5;
      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setVirtualTemperature(unitId, zone, setVirtualTemperature);

      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 0, 'writeHold', 215);
    });

    it('should read fan speed', async () => {
      const fanSpeed = 3;
      readOrWriteSpy.mockResolvedValue(fanSpeed);

      const result = await adapter.getFanSpeed(unitId, zone);

      expect(result).toBe(fanSpeed);
      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 2, 'readHold', 1);
    });

    it('should write fan speed 3 and power on first', async () => {
      const setFanSpeed = 3;
      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setFanSpeed(unitId, zone, setFanSpeed);

      expect(readOrWriteSpy).toHaveBeenNthCalledWith(1, unitId, 1, 'writeHold', 1,);
      expect(readOrWriteSpy).toHaveBeenNthCalledWith(2, unitId, 2, 'writeHold', 3,);
    });

    it('should write fan speed 0 and power off first', async () => {
      const setFanSpeed = 0;

      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setFanSpeed(unitId, zone, setFanSpeed);

      expect(readOrWriteSpy).toHaveBeenNthCalledWith(1, unitId, 1, 'writeHold', 0,
      );
      expect(readOrWriteSpy).toHaveBeenNthCalledWith(2, unitId, 2, 'writeHold', 0,);
    });

    it('should write auto fan speed when speed is -1', async () => {
      const setFanSpeed = -1;
      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setFanSpeed(unitId, zone, setFanSpeed);

      expect(readOrWriteSpy).toHaveBeenNthCalledWith(1, unitId, 1, 'writeHold', 1,);
      expect(readOrWriteSpy).toHaveBeenNthCalledWith(2, unitId, 2, 'writeHold', 2,);
    });

    it('should return fan mode 0 when fan speed is 0', async () => {
      const fanMode = 0;
      jest.spyOn(adapter, 'getFanSpeed').mockResolvedValue(fanMode);

      const result = await adapter.getFanMode(unitId, zone);

      expect(result).toBe(fanMode);
    });

    it('should return fan mode 1 when fan speed is -1', async () => {
      const fanMode = 1;
      const fanSpeed = -1;
      jest.spyOn(adapter, 'getFanSpeed').mockResolvedValue(fanSpeed);

      const result = await adapter.getFanMode(unitId, zone);

      expect(result).toBe(fanMode);
    });

    it('should return fan mode speed + 1 for normal speeds', async () => {
      const fanSpeed = 3;
      const fanMode = 4;
      jest.spyOn(adapter, 'getFanSpeed').mockResolvedValue(fanSpeed);

      const result = await adapter.getFanMode(unitId, zone);

      expect(result).toBe(fanMode);
    });

    it('should set fan mode 0 by calling setFanSpeed with 0', async () => {
      const fanMode = 0;
      const fanSpeed = 0;

      const setFanSpeedSpy = jest.spyOn(adapter, 'setFanSpeed').mockResolvedValue(undefined);

      await adapter.setFanMode(unitId, zone, fanMode);

      expect(setFanSpeedSpy).toHaveBeenCalledWith(unitId, zone, fanSpeed);
    });

    it('should set fan mode 1 by calling setFanSpeed with -1', async () => {
      const fanMode = 1;
      const fanSpeed = -1;
      const setFanSpeedSpy = jest.spyOn(adapter, 'setFanSpeed').mockResolvedValue(undefined);

      await adapter.setFanMode(unitId, zone, fanMode);

      expect(setFanSpeedSpy).toHaveBeenCalledWith(unitId, zone, fanSpeed);
    });

    it('should set fan mode 4 by calling setFanSpeed with 3', async () => {
      const fanMode = 4;
      const fanSpeed = 3;
      const setFanSpeedSpy = jest.spyOn(adapter, 'setFanSpeed').mockResolvedValue(undefined);

      await adapter.setFanMode(unitId, zone, fanMode);

      expect(setFanSpeedSpy).toHaveBeenCalledWith(unitId, zone, fanSpeed);
    });
  });

  describe('Type B - FC-3000DC/FC-3500DC', () => {
    beforeEach(() => {
      adapter = new HopmannAdapter(connectionTypeB);
      readOrWriteSpy = jest.spyOn(adapter as any, 'readOrWrite');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should use temperature register 0 for type B', async () => {
      const SetTemperature = 21.5;
      readOrWriteSpy.mockResolvedValue(215);

      const result = await adapter.getSetpoint(unitId, zone);

      expect(result).toBe(SetTemperature);
      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 0, 'readInput', 1);
    });

    it('should use fan register 1 for type B', async () => {
      const fanSpeed = 2;
      readOrWriteSpy.mockResolvedValue(fanSpeed);

      const result = await adapter.getFanSpeed(unitId, zone);

      expect(result).toBe(fanSpeed);
      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 1, 'readHold', 1);
    });

    it('should use power register 2 for type B when setting fan speed', async () => {
      const fanSpeed = 3;
      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setFanSpeed(unitId, zone, fanSpeed);

      expect(readOrWriteSpy).toHaveBeenNthCalledWith(1, unitId, 2, 'writeHold', 1,);
      expect(readOrWriteSpy).toHaveBeenNthCalledWith(2, unitId, 1, 'writeHold', 3,);
    });

    it('should write fan speed 0 correctly for type B', async () => {
      const fanSpeed = 0;
      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setFanSpeed(unitId, zone, fanSpeed);

      expect(readOrWriteSpy).toHaveBeenNthCalledWith(1, unitId, 2, 'writeHold', 0,);
      expect(readOrWriteSpy).toHaveBeenNthCalledWith(2, unitId, 1, 'writeHold', 0,);
    });

    it('should write auto fan speed correctly for type B', async () => {
      const fanSpeed = -1;
      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setFanSpeed(unitId, zone, fanSpeed);

      expect(readOrWriteSpy).toHaveBeenNthCalledWith(1, unitId, 2, 'writeHold', 1,);
      expect(readOrWriteSpy).toHaveBeenNthCalledWith(2, unitId, 1, 'writeHold', 2,);
    });
  });

  describe('Unknown device type', () => {
    beforeEach(() => {
      adapter = new HopmannAdapter(connectionUnknown);
      readOrWriteSpy = jest.spyOn(adapter as any, 'readOrWrite');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should use fallback temperature register 100', async () => {
      const setTemperature = 20.5;
      readOrWriteSpy.mockResolvedValue(205);

      const result = await adapter.getSetpoint(unitId, zone);

      expect(result).toBe(setTemperature);
      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 100, 'readInput', 1);
    });

    it('should use fallback fan register 102', async () => {
      const fanSpeed = 3;
      readOrWriteSpy.mockResolvedValue(30);

      const result = await adapter.getFanSpeed(unitId, zone);

      expect(result).toBe(fanSpeed);
      expect(readOrWriteSpy).toHaveBeenCalledWith(unitId, 102, 'readHold', 1);
    });

    it('should encode fan speed x10 for unknown type', async () => {
      const fanSpeed = 3;
      readOrWriteSpy.mockResolvedValue(undefined);

      await adapter.setFanSpeed(unitId, zone, fanSpeed);

      expect(readOrWriteSpy).toHaveBeenNthCalledWith(1, unitId, 102, 'writeHold', 1,);
      expect(readOrWriteSpy).toHaveBeenNthCalledWith(2, unitId, 102, 'writeHold', 30,);
    });

    it('should decode fan speed /10 for unknown type', async () => {
      const fanSpeed = 4;
      readOrWriteSpy.mockResolvedValue(40);

      const result = await adapter.getFanSpeed(unitId, zone);

      expect(result).toBe(fanSpeed);
    });
  });
});
