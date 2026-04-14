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
    mockModbusInstance.writeRegister.mockResolvedValue(undefined);

    await client.writeRegister(12, 99);

    expect(mockModbusInstance.writeRegister).toHaveBeenCalledWith(12, 99);
  });

  it('should warn when no stored host or port exists for reconnect', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    client.handleReconnect();

    expect(warnSpy).toHaveBeenCalledWith(
      'Connection lost. No stored host/port to reconnect to.',
    );
  });

  it('should do nothing when already reconnecting', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const connectSpy = jest.spyOn(client, 'connect');

    (client as any).reconnecting = true;
    (client as any).lastHost = '192.168.1.10';
    (client as any).lastPort = 502;

    client.handleReconnect();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('should attempt reconnect and log success', async () => {
    jest.useFakeTimers();

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const connectSpy = jest
      .spyOn(client, 'connect')
      .mockResolvedValue(undefined);

    (client as any).lastHost = '192.168.1.10';
    (client as any).lastPort = 502;

    client.handleReconnect();

    expect((client as any).reconnecting).toBe(true);
    expect((client as any).connected).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'Connection lost. Attempting to reconnect...',
    );

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(connectSpy).toHaveBeenCalledWith('192.168.1.10', 502);
    expect(logSpy).toHaveBeenCalledWith('Reconnected successfully');
  });

  it('should log error and reset reconnecting when reconnect fails', async () => {
    jest.useFakeTimers();

    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(client, 'connect').mockRejectedValue(new Error('boom'));

    (client as any).lastHost = '192.168.1.10';
    (client as any).lastPort = 502;

    client.handleReconnect();

    expect((client as any).reconnecting).toBe(true);

    await jest.advanceTimersByTimeAsync(5000);

    expect(errorSpy).toHaveBeenCalledWith('Reconnection failed:', 'boom');
    expect((client as any).reconnecting).toBe(false);
  });
});
