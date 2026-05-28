import { connect, type MqttClient } from 'mqtt';
import type { PanelStateMessage, SyncMessage } from './SyncTypes';

export default class MqttSyncBus {
  private client: MqttClient | null = null;
  private readonly eventsTopic: string;
  private readonly panelStateTopicBase: string;
  private readonly panelStateTopicFilter: string;

  constructor(
    private brokerUrl: string,
    private sourceInstanceId: string,
    topicPrefix = 'airco/sync',
  ) {
    this.eventsTopic = `${topicPrefix}/events`;
    this.panelStateTopicBase = `${topicPrefix}/panel-state`;
    this.panelStateTopicFilter = `${this.panelStateTopicBase}/+/+/+/+/+`;
  }

  async start(
    handlers: {
      onSyncMessage: (message: SyncMessage) => Promise<void>;
      onPanelStateMessage: (message: PanelStateMessage) => Promise<void>;
    },
  ): Promise<void> {
    if (this.client) {
      return;
    }

    const client = connect(this.brokerUrl, {
      reconnectPeriod: 1000,
      clean: true,
    });

    this.client = client;

    client.on('error', (error) => {
      console.error('[MqttSyncBus] error', error);
    });

    client.on('message', (topic, payload) => {
      void this.handleIncomingMessage(topic, payload, handlers);
    });

    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('error', (error) => reject(error));
    });

    await new Promise<void>((resolve, reject) => {
      client.subscribe(
        [this.eventsTopic, this.panelStateTopicFilter],
        { qos: 1 },
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        },
      );
    });

    console.log(
      `[MqttSyncBus] connected broker=${this.brokerUrl} eventsTopic=${this.eventsTopic} panelStateTopicFilter=${this.panelStateTopicFilter}`,
    );
  }

  async stop(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;

    await new Promise<void>((resolve) => {
      client.end(false, {}, () => resolve());
    });
  }

  async publish(message: SyncMessage): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT not connected');
    }

    await new Promise<void>((resolve, reject) => {
      this.client!.publish(
        this.eventsTopic,
        JSON.stringify(message),
        { qos: 1 },
        (error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        },
      );
    });
  }

  async publishPanelState(message: PanelStateMessage): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT not connected');
    }

    const topic = this.getPanelStateTopic(message);

    await new Promise<void>((resolve, reject) => {
      this.client!.publish(
        topic,
        JSON.stringify(message),
        { qos: 1, retain: true },
        (error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        },
      );
    });
  }

  private async handleIncomingMessage(
    topic: string,
    payload: Buffer,
    handlers: {
      onSyncMessage: (message: SyncMessage) => Promise<void>;
      onPanelStateMessage: (message: PanelStateMessage) => Promise<void>;
    },
  ): Promise<void> {
    try {
      const message = JSON.parse(payload.toString()) as
        | SyncMessage
        | PanelStateMessage;

      if (topic === this.eventsTopic) {
        if (message.schema !== 'aircotest.sync.v4') {
          return;
        }

        await handlers.onSyncMessage(message as SyncMessage);
        return;
      }

      if (!this.matchesPanelStateTopic(topic)) {
        return;
      }

      if (message.schema !== 'aircotest.panel-state.v1') {
        return;
      }

      await handlers.onPanelStateMessage(message as PanelStateMessage);
    } catch (error) {
      console.error('[MqttSyncBus] invalid message', error);
    }
  }

  private getPanelStateTopic(message: PanelStateMessage): string {
    return [
      this.panelStateTopicBase,
      message.zoneId,
      message.roomId,
      message.panelId,
      String(message.unitId),
      String(message.zone),
    ].join('/');
  }

  private matchesPanelStateTopic(topic: string): boolean {
    const expectedSegments = this.panelStateTopicFilter.split('/').length;
    return (
      topic.startsWith(this.panelStateTopicBase) &&
      topic.split('/').length === expectedSegments
    );
  }
}
