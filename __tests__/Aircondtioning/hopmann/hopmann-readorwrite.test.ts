import HopmannAdapter from '../../../src/Airco/adapters/hopmann/HopmannAdapter';
import { AircoConnection } from '../../../src/Airco/adapters/IAircoAdapter';
import * as net from 'net';
import * as jsmodbus from 'jsmodbus';

jest.mock('net', () => ({
  Socket: jest.fn(),
}));

jest.mock('jsmodbus', () => ({
  client: {
    TCP: jest.fn(),
  },
}));

describe('HopmannAdapter readOrWrite', () => {
  const connection: AircoConnection = {
    host: '192.168.33.5',
    port: 300,
    type: 'FC-500PC/FC-1100PC',
  };

  let adapter: HopmannAdapter;

  let fakeSocket: {
    once: jest.Mock;
    setTimeout: jest.Mock;
    connect: jest.Mock;
    end: jest.Mock;
    destroy: jest.Mock;
    emit: (event: string, value?: any) => void;
  };

  let fakeClient: {
    readInputRegisters: jest.Mock;
    readHoldingRegisters: jest.Mock;
    writeSingleRegister: jest.Mock;
  };

  let handlers: Record<string, (...args: any[]) => void>;

  beforeEach(() => {
    handlers = {};

    fakeSocket = {
      once: jest.fn((event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
        return fakeSocket;
      }),
      setTimeout: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
      emit: (event: string, value?: any) => {
        if (handlers[event]) {
          handlers[event](value);
        }
      },
    };

    fakeClient = {
      readInputRegisters: jest.fn(),
      readHoldingRegisters: jest.fn(),
      writeSingleRegister: jest.fn(),
    };

    (net.Socket as unknown as jest.Mock).mockImplementation(() => fakeSocket);
    ((jsmodbus as any).client.TCP as jest.Mock).mockImplementation(
      () => fakeClient,
    );

    adapter = new HopmannAdapter(connection);
  });

  it('should read input register', async () => {
    fakeClient.readInputRegisters.mockResolvedValue({
      response: {
        _body: {
          _values: [205],
        },
      },
    });

    const promise = (adapter as any).readOrWrite(1, 10, 'readInput', 1);

    expect(fakeSocket.setTimeout).toHaveBeenCalledWith(5000);
    expect(fakeSocket.connect).toHaveBeenCalledWith({
      host: connection.host,
      port: connection.port,
    });

    fakeSocket.emit('connect');

    const result = await promise;

    expect((jsmodbus as any).client.TCP).toHaveBeenCalledWith(fakeSocket, 1);
    expect(fakeClient.readInputRegisters).toHaveBeenCalledWith(10, 1);
    expect(fakeSocket.end).toHaveBeenCalled();
    expect(result).toBe(205);
  });

  it('should read holding register', async () => {
    fakeClient.readHoldingRegisters.mockResolvedValue({
      response: {
        _body: {
          _values: [33],
        },
      },
    });

    const promise = (adapter as any).readOrWrite(2, 20, 'readHold', 1);

    fakeSocket.emit('connect');

    const result = await promise;

    expect(fakeClient.readHoldingRegisters).toHaveBeenCalledWith(20, 1);
    expect(fakeSocket.end).toHaveBeenCalled();
    expect(result).toBe(33);
  });

  it('should write single register', async () => {
    const writeResponse = { ok: true };
    fakeClient.writeSingleRegister.mockResolvedValue(writeResponse);

    const promise = (adapter as any).readOrWrite(3, 30, 'writeHold', 123);

    fakeSocket.emit('connect');

    const result = await promise;

    expect(fakeClient.writeSingleRegister).toHaveBeenCalledWith(30, 123);
    expect(fakeSocket.end).toHaveBeenCalled();
    expect(result).toBe(writeResponse);
  });

  it('should return 0 when read input response has no value', async () => {
    fakeClient.readInputRegisters.mockResolvedValue({
      response: {
        _body: {
          _values: [],
        },
      },
    });

    const promise = (adapter as any).readOrWrite(1, 10, 'readInput', 1);

    fakeSocket.emit('connect');

    const result = await promise;

    expect(result).toBe(0);
  });

  it('should reject on socket error', async () => {
    const promise = (adapter as any).readOrWrite(1, 10, 'readInput', 1);

    const error = new Error('socket failed');
    fakeSocket.emit('error', error);

    await expect(promise).rejects.toThrow('socket failed');
    expect(fakeSocket.end).toHaveBeenCalled();
    expect(fakeSocket.destroy).toHaveBeenCalled();
  });

  it('should reject on socket timeout', async () => {
    const promise = (adapter as any).readOrWrite(1, 10, 'readInput', 1);

    fakeSocket.emit('timeout');

    await expect(promise).rejects.toThrow('hopmann socket timeout');
    expect(fakeSocket.end).toHaveBeenCalled();
    expect(fakeSocket.destroy).toHaveBeenCalled();
  });

  it('should reject when client read throws', async () => {
    fakeClient.readHoldingRegisters.mockRejectedValue(
      new Error('modbus read failed'),
    );

    const promise = (adapter as any).readOrWrite(1, 10, 'readHold', 1);

    fakeSocket.emit('connect');

    await expect(promise).rejects.toThrow('modbus read failed');
    expect(fakeSocket.end).toHaveBeenCalled();
    expect(fakeSocket.destroy).toHaveBeenCalled();
  });

  it('should reject when client write throws', async () => {
    fakeClient.writeSingleRegister.mockRejectedValue(
      new Error('modbus write failed'),
    );

    const promise = (adapter as any).readOrWrite(1, 10, 'writeHold', 99);

    fakeSocket.emit('connect');

    await expect(promise).rejects.toThrow('modbus write failed');
    expect(fakeSocket.end).toHaveBeenCalled();
    expect(fakeSocket.destroy).toHaveBeenCalled();
  });
});
