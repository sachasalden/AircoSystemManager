import { EventEmitter } from 'events';
import { connect } from 'mqtt';
import MqttSyncBus from '../src/Airco/services/MqttSyncBus';
import type { SyncMessage } from '../src/Airco/services/SyncTypes';

jest.mock('mqtt', () => ({
  connect: jest.fn(),
}));

describe('MqttSyncBus', () => {
  const BROKER_URL = 'mqtt://localhost:1883';
  const SOURCE_INSTANCE_ID = 'instance-a';
  const OTHER_INSTANCE_ID = 'instance-b';
  const TOPIC_PREFIX = 'airco/sync';
  const TOPIC = `${TOPIC_PREFIX}/events`;
  const QOS = 1;
  const RECONNECT_PERIOD = 1000;
  const CLEAN_SESSION = true;
  const VALID_SCHEMA = 'aircotest.sync.v4';

  let onMessage: jest.Mock;
  let onPanelStateMessage: jest.Mock;
  let handlers: {
    onSyncMessage: jest.Mock;
    onPanelStateMessage: jest.Mock;
  };
  let mockClient: any;
  let bus: MqttSyncBus;

  const validMessage: SyncMessage = {
    schema: VALID_SCHEMA,
    sourceInstanceId: OTHER_INSTANCE_ID,
  } as SyncMessage;

  function createMockClient() {
    const emitter = new EventEmitter();

    const client: any = {
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        emitter.on(event, handler);
        return client;
      }),
      once: jest.fn((event: string, handler: (...args: any[]) => void) => {
        emitter.once(event, handler);
        return client;
      }),
      subscribe: jest.fn(
        (
          _topic: string | string[],
          _options: { qos: number },
          callback: (error?: Error | null) => void,
        ) => {
          callback();
        },
      ),
      end: jest.fn(
        (
          _force: boolean,
          _options: Record<string, never>,
          callback: () => void,
        ) => {
          callback();
        },
      ),
      publish: jest.fn(
        (
          _topic: string,
          _payload: string,
          _options: { qos: number },
          callback: (error?: Error) => void,
        ) => {
          callback();
        },
      ),
      emit: emitter.emit.bind(emitter),
    };

    return client;
  }

  async function flushAsyncWork() {
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    jest.clearAllMocks();

    onMessage = jest.fn().mockResolvedValue(undefined);
    onPanelStateMessage = jest.fn().mockResolvedValue(undefined);
    handlers = {
      onSyncMessage: onMessage,
      onPanelStateMessage,
    };
    mockClient = createMockClient();
    (connect as jest.Mock).mockReturnValue(mockClient);

    bus = new MqttSyncBus(BROKER_URL, SOURCE_INSTANCE_ID, TOPIC_PREFIX);
  });

  it('should connect and subscribe on start', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    expect(connect).toHaveBeenCalledWith(BROKER_URL, {
      reconnectPeriod: RECONNECT_PERIOD,
      clean: CLEAN_SESSION,
    });
    expect(mockClient.subscribe).toHaveBeenCalledWith(
      [TOPIC, `${TOPIC_PREFIX}/panel-state/+/+/+/+/+`],
      { qos: QOS },
      expect.any(Function),
    );
    expect(logSpy).toHaveBeenCalledWith(
      `[MqttSyncBus] connected broker=${BROKER_URL} eventsTopic=${TOPIC} panelStateTopicFilter=${TOPIC_PREFIX}/panel-state/+/+/+/+/+`,
    );
  });

  it('should not connect twice when already started', async () => {
    const firstStart = bus.start(handlers);
    mockClient.emit('connect');
    await firstStart;

    await bus.start(handlers);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(mockClient.subscribe).toHaveBeenCalledTimes(1);
  });

  it('should reject start when connect fails', async () => {
    const error = new Error('connect failed');

    const startPromise = bus.start(handlers);
    mockClient.emit('error', error);

    await expect(startPromise).rejects.toThrow('connect failed');
  });

  it('should reject start when subscribe fails', async () => {
    const subscribeError = new Error('subscribe failed');
    mockClient.subscribe.mockImplementation(
      (
        _topic: string,
        _options: { qos: number },
        callback: (error?: Error | null) => void,
      ) => {
        callback(subscribeError);
      },
    );

    const startPromise = bus.start(handlers);
    mockClient.emit('connect');

    await expect(startPromise).rejects.toThrow('subscribe failed');
  });

  it('should stop safely when not started', async () => {
    await expect(bus.stop()).resolves.toBeUndefined();
  });

  it('should end client on stop', async () => {
    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    await bus.stop();

    expect(mockClient.end).toHaveBeenCalledWith(
      false,
      {},
      expect.any(Function),
    );
  });

  it('should publish message after start', async () => {
    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    await bus.publish(validMessage);

    expect(mockClient.publish).toHaveBeenCalledWith(
      TOPIC,
      JSON.stringify(validMessage),
      { qos: QOS },
      expect.any(Function),
    );
  });

  it('should throw when publishing without connection', async () => {
    await expect(bus.publish(validMessage)).rejects.toThrow(
      'MQTT not connected',
    );
  });

  it('should reject publish when mqtt publish fails', async () => {
    const publishError = new Error('publish failed');

    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    mockClient.publish.mockImplementation(
      (
        _topic: string,
        _payload: string,
        _options: { qos: number },
        callback: (error?: Error) => void,
      ) => {
        callback(publishError);
      },
    );

    await expect(bus.publish(validMessage)).rejects.toThrow('publish failed');
  });

  it('should call onMessage for valid external message', async () => {
    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    mockClient.emit(
      'message',
      TOPIC,
      Buffer.from(JSON.stringify(validMessage)),
    );
    await flushAsyncWork();

    expect(onMessage).toHaveBeenCalledWith(validMessage);
  });

  it('should pass message from same source instance to the handler', async () => {
    const ownMessage: SyncMessage = {
      ...validMessage,
      sourceInstanceId: SOURCE_INSTANCE_ID,
    };

    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    mockClient.emit('message', TOPIC, Buffer.from(JSON.stringify(ownMessage)));
    await flushAsyncWork();

    expect(onMessage).toHaveBeenCalledWith(ownMessage);
  });

  it('should ignore message with wrong schema', async () => {
    const wrongSchemaMessage: SyncMessage = {
      ...validMessage,
      schema: 'wrong.schema',
    } as SyncMessage;

    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    mockClient.emit(
      'message',
      TOPIC,
      Buffer.from(JSON.stringify(wrongSchemaMessage)),
    );
    await flushAsyncWork();

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('should ignore message from another topic', async () => {
    const OTHER_TOPIC = 'airco/other/events';

    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    mockClient.emit(
      'message',
      OTHER_TOPIC,
      Buffer.from(JSON.stringify(validMessage)),
    );
    await flushAsyncWork();

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('should log invalid message when payload is not valid json', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    mockClient.emit('message', TOPIC, Buffer.from('not-json'));
    await flushAsyncWork();

    expect(errorSpy).toHaveBeenCalledWith(
      '[MqttSyncBus] invalid message',
      expect.any(Error),
    );
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('should log mqtt client errors', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const clientError = new Error('mqtt client error');

    const startPromise = bus.start(handlers);
    mockClient.emit('connect');
    await startPromise;

    mockClient.emit('error', clientError);

    expect(errorSpy).toHaveBeenCalledWith('[MqttSyncBus] error', clientError);
  });
});

