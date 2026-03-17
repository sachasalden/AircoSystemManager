import { connect, type MqttClient } from 'mqtt';

import type { SyncMessage } from './SyncTypes';

type Handlers = {
  onPanelMessage: (message: SyncMessage) => Promise<void>;
  onAircoMessage: (message: SyncMessage) => Promise<void>;
};

export default class MqttBridgeService {
  private client: MqttClient | null = null;
  private readonly panelTopic: string;
  private readonly aircoTopic: string;

  constructor(
    private brokerUrl: string,
    topicPrefix = 'airco/sync',
  ) {
    this.panelTopic = `${topicPrefix}/panel/state`;
    this.aircoTopic = `${topicPrefix}/airco/state`;
  }

  async start(handlers: Handlers): Promise<void> {
    if (this.client) {
      return;
    }

    const client = connect(this.brokerUrl);
    this.client = client;

    client.on('error', (error) => {
      console.error('[MqttBridgeService] MQTT error', error);
    });

    client.on('message', (topic, payload) => {
      void this.handleIncomingMessage(topic, payload, handlers);
    });

    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('error', (error) => reject(error));
    });

    await Promise.all([
      this.subscribe(client, this.panelTopic),
      this.subscribe(client, this.aircoTopic),
    ]);

    console.log(`[MqttBridgeService] connected to ${this.brokerUrl}`);
  }

  async publishPanelChange(message: SyncMessage): Promise<void> {
    await this.publish(this.panelTopic, message);
  }

  async publishAircoChange(message: SyncMessage): Promise<void> {
    await this.publish(this.aircoTopic, message);
  }

  private async publish(topic: string, message: SyncMessage): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client is not connected');
    }

    await new Promise<void>((resolve, reject) => {
      this.client!.publish(
        topic,
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

  private async subscribe(client: MqttClient, topic: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async handleIncomingMessage(
    topic: string,
    payload: Buffer,
    handlers: Handlers,
  ): Promise<void> {
    try {
      const message = JSON.parse(payload.toString()) as SyncMessage;

      if (message?.schema !== 'aircotest.sync.v1') {
        return;
      }

      if (topic === this.panelTopic) {
        await handlers.onPanelMessage(message);
        return;
      }

      if (topic === this.aircoTopic) {
        await handlers.onAircoMessage(message);
      }
    } catch (error) {
      console.error('[MqttBridgeService] Failed to process MQTT message', error);
    }
  }
}
