import PolarbearService from '../../src/Airco/services/PolarbearService';
import ModbusClient from '../../src/Airco/clients/ModbusClient';

describe('PolarbearService', () => {
  let client: jest.Mocked<ModbusClient>;
  let service: PolarbearService;

  beforeEach(() => {
    client = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      close: jest.fn(),
      handleReconnect: jest.fn(),
      setID: jest.fn(),
      readHoldingRegisters: jest.fn(),
      writeRegister: jest.fn(),
    } as unknown as jest.Mocked<ModbusClient>;

    service = new PolarbearService(client);
  });

  it('should get setpoint for zone 1', async () => {
    const setTemperature = 21.5;
    client.readHoldingRegisters.mockResolvedValue([215]);

    const result = await service.getSetpoint(1, 1);

    expect(client.setID).toHaveBeenCalledWith(1);
    expect(client.readHoldingRegisters).toHaveBeenCalledWith(601, 1);
    expect(result).toBe(setTemperature);
  });

  it('should set setpoint for zone 2', async () => {
    const setTemperature = 23.5;
    await service.setSetpoint(1, 2, setTemperature);

    expect(client.setID).toHaveBeenCalledWith(1);
    expect(client.writeRegister).toHaveBeenCalledWith(701, 235);
  });

  it('should get virtual temperature for v1', async () => {
    client.readHoldingRegisters
      .mockRejectedValueOnce(new Error('no v2'))
      .mockResolvedValueOnce([224]);

    const result = await service.getVirtualTemperature(1, 1);

    expect(client.setID).toHaveBeenCalledWith(1);
    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(1, 7001, 1);
    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(2, 603, 1);
    expect(result).toBe(22.4);
  });

  it('should get virtual temperature for v2', async () => {
    client.readHoldingRegisters
      .mockResolvedValueOnce([1234])
      .mockResolvedValueOnce([0xf8e1]);

    const result = await service.getVirtualTemperature(1, 1);

    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(1, 7001, 1);
    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(2, 21051, 1);
    expect(result).toBe(22.5);
  });

  it('should cache detected version', async () => {
    client.readHoldingRegisters
      .mockResolvedValueOnce([1234])
      .mockResolvedValueOnce([0xf8e1])
      .mockResolvedValueOnce([0xf8d7]);

    const first = await service.getVirtualTemperature(1, 1);
    const second = await service.getVirtualTemperature(1, 2);

    expect(first).toBe(22.5);
    expect(second).toBe(21.5);

    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(1, 7001, 1);
    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(2, 21051, 1);
    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(3, 22051, 1);
  });

  it('should set virtual temperature for v1', async () => {
    client.readHoldingRegisters.mockRejectedValueOnce(new Error('no v2'));

    await service.setVirtualTemperature(1, 2, 21.5);

    expect(client.readHoldingRegisters).toHaveBeenCalledWith(7001, 1);
    expect(client.writeRegister).toHaveBeenCalledWith(703, 215);
  });

  it('should set virtual temperature for v2 and preserve upper bits', async () => {
    client.readHoldingRegisters
      .mockResolvedValueOnce([1234])
      .mockResolvedValueOnce([0xf800]);

    await service.setVirtualTemperature(1, 1, 22.5);

    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(1, 7001, 1);
    expect(client.readHoldingRegisters).toHaveBeenNthCalledWith(2, 21051, 1);
    expect(client.writeRegister).toHaveBeenCalledWith(21051, 0xf8e1);
  });

  it('should get fan speed', async () => {
    // @ts-ignore
    client.readHoldingRegisters.mockResolvedValue({ data: [3] });

    const result = await service.getFanSpeed(1, 2);

    expect(client.readHoldingRegisters).toHaveBeenCalledWith(707, 1);
    expect(result).toBe(3);
  });

  it('should set fan speed', async () => {
    await service.setFanSpeed(1, 1, 2);

    expect(client.writeRegister).toHaveBeenCalledWith(607, 2);
  });

  it('should get fan mode', async () => {
    client.readHoldingRegisters.mockResolvedValue([4]);

    const result = await service.getFanMode(1, 2);

    expect(client.readHoldingRegisters).toHaveBeenCalledWith(706, 1);
    expect(result).toBe(4);
  });

  it('should set fan mode', async () => {
    await service.setFanMode(1, 1, 5);

    expect(client.writeRegister).toHaveBeenCalledWith(606, 5);
  });

  it('should get flags', async () => {
    client.readHoldingRegisters.mockResolvedValue([258]);

    const result = await service.getFlags(1);

    expect(client.readHoldingRegisters).toHaveBeenCalledWith(110, 1);
    expect(result).toBe(258);
  });

  it('should set flag using provided currentFlags', async () => {
    await service.setFlag(1, 1, 'setpoint', 0);

    expect(client.writeRegister).toHaveBeenCalledWith(110, 1);
  });

  it('should set flag using getFlags when currentFlags is not provided', async () => {
    client.readHoldingRegisters.mockResolvedValue([0]);

    await service.setFlag(1, 2, 'fanMode');

    expect(client.readHoldingRegisters).toHaveBeenCalledWith(110, 1);
    expect(client.writeRegister).toHaveBeenCalledWith(110, 512);
  });

  it('should not write setFlag when bit is already set', async () => {
    await service.setFlag(1, 1, 'setpoint', 1);

    expect(client.writeRegister).not.toHaveBeenCalled();
  });

  it('should clear flag using provided currentFlags', async () => {
    await service.clearFlag(1, 1, 'fanMode', 2);

    expect(client.writeRegister).toHaveBeenCalledWith(110, 0);
  });

  it('should clear flag using getFlags when currentFlags is not provided', async () => {
    client.readHoldingRegisters.mockResolvedValue([512]);

    await service.clearFlag(1, 2, 'fanMode');

    expect(client.readHoldingRegisters).toHaveBeenCalledWith(110, 1);
    expect(client.writeRegister).toHaveBeenCalledWith(110, 0);
  });

  it('should not write clearFlag when bit is already clear', async () => {
    await service.clearFlag(1, 1, 'setpoint', 0);

    expect(client.writeRegister).not.toHaveBeenCalled();
  });

  it('should get pending setpoint for zone 1', async () => {
    client.readHoldingRegisters.mockResolvedValue([0x37c0]);

    const result = await service.getPendingSetpoint(1, 1);

    expect(client.readHoldingRegisters).toHaveBeenCalledWith(117, 1);
    expect(result).toBe(22.3);
  });

  it('should get pending fan mode for zone 2', async () => {
    client.readHoldingRegisters.mockResolvedValue([5]);

    const result = await service.getPendingFanMode(1, 2);

    expect(client.readHoldingRegisters).toHaveBeenCalledWith(118, 1);
    expect(result).toBe(5);
  });
});
