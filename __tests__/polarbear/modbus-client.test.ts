import ModbusClient from '../../src/Airco/clients/ModbusClient';
import ModbusRTU from 'modbus-serial';

let mockModbusInstance: {
  setTimeout: jest.Mock;
  connectTelnet: jest.Mock;
  close: jest.Mock;
  setID: jest.Mock;
  readHoldingRegisters: jest.Mock;
  writeRegister: jest.Mock;
};

jest.mock('modbus-serial', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    mockModbusInstance = {
      setTimeout: jest.fn(),
      connectTelnet: jest.fn(),
      close: jest.fn(),
      setID: jest.fn(),
      readHoldingRegisters: jest.fn(),
      writeRegister: jest.fn(),
    };

    return mockModbusInstance;
  }),
}));

describe('ModbusClient', () => {
  let client: ModbusClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    client = new ModbusClient(10000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('should create ModbusRTU client and set timeout', () => {
    expect(ModbusRTU).toHaveBeenCalledTimes(1);
    expect(mockModbusInstance.setTimeout).toHaveBeenCalledWith(10000);
  });

  it('should connect successfully', async () => {
    mockModbusInstance.connectTelnet.mockImplementation(
      (_host: string, _options: { port: number }, cb: (err?: any) => void) => {
        cb(null);
      },
    );

    await client.connect('192.168.1.10', 502);

    expect(mockModbusInstance.connectTelnet).toHaveBeenCalledWith(
      '192.168.1.10',
      { port: 502 },
      expect.any(Function),
    );
    expect((client as any).connected).toBe(true);
  });

  it('should disconnect when connected', async () => {
    (client as any).connected = true;

    mockModbusInstance.close.mockImplementation((cb: () => void) => {
      cb();
    });

    await client.disconnect();

    expect(mockModbusInstance.close).toHaveBeenCalled();
    expect((client as any).connected).toBe(false);
  });

  it('should set id', () => {
    client.setID(7);
    expect(mockModbusInstance.setID).toHaveBeenCalledWith(7);
  });

  it('should read holding registers', async () => {
    (client as any).connected = true;
    mockModbusInstance.readHoldingRegisters.mockResolvedValue({
      data: [10, 20],
    });

    const result = await client.readHoldingRegisters(100, 2);

    expect(result).toEqual([10, 20]);
    expect(mockModbusInstance.readHoldingRegisters).toHaveBeenCalledWith(
      100,
      2,
    );
  });

  it('should write register', async () => {
    (client as any).connected = true;
    mockModbusInstance.writeRegister.mockResolvedValue(undefined);

    await client.writeRegister(12, 99);

    expect(mockModbusInstance.writeRegister).toHaveBeenCalledWith(12, 99);
  });

  it('should throw when reading without an active or stored connection', async () => {
    await expect(client.readHoldingRegisters(100, 1)).rejects.toThrow(
      'Modbus client is not connected',
    );
  });

  it('should mark disconnected and reset the underlying client', () => {
    (client as any).connected = true;

    client.markDisconnected();

    expect((client as any).connected).toBe(false);
    expect(ModbusRTU).toHaveBeenCalledTimes(2);
  });
});
