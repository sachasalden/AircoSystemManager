import { connect, type MqttClient } from 'mqtt';
import type { SyncMessage } from './SyncTypes';

export default class MqttSyncBus {
  private client: MqttClient | null = null;
  private readonly topic: string;

  constructor(
    private brokerUrl: string,
    private sourceInstanceId: string,
    topicPrefix = 'airco/sync',
  ) {
    this.topic = `${topicPrefix}/events`;
  }

  async start(
    onMessage: (message: SyncMessage) => Promise<void>,
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
      void this.handleIncomingMessage(topic, payload, onMessage);
    });

    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('error', (error) => reject(error));
    });

    await new Promise<void>((resolve, reject) => {
      client.subscribe(this.topic, { qos: 1 }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    console.log(
      `[MqttSyncBus] connected broker=${this.brokerUrl} topic=${this.topic}`,
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
        this.topic,
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

  private async handleIncomingMessage(
    topic: string,
    payload: Buffer,
    onMessage: (message: SyncMessage) => Promise<void>,
  ): Promise<void> {
    if (topic !== this.topic) {
      return;
    }

    try {
      const message = JSON.parse(payload.toString()) as SyncMessage;

      if (message.schema !== 'aircotest.sync.v4') {
        return;
      }

      // Eigen berichten negeren is nu prima,
      // want lokale routing doen we direct in SyncMainLoop.
      if (message.sourceInstanceId === this.sourceInstanceId) {
        return;
      }

      await onMessage(message);
    } catch (error) {
      console.error('[MqttSyncBus] invalid message', error);
    }
  }
}
