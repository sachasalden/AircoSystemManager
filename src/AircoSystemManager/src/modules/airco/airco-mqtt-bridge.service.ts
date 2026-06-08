import * as mqtt from 'mqtt';
import {
  CONFIG,
  createTopics,
  type MqttTopics,
} from '../../config/runtime.config';
import type { RuntimeSettings } from '../../types/shared.types';
import {
  formatError,
  isTimeoutError,
  log,
  normalizeFanMode,
  round1,
  roundHalf,
  sleep,
  toNumber,
  virtualTempSignature,
} from '../../utils/helpers';
import type { AircoAdapter } from './airco-adapter';
import type { AircoAdapterRegistry } from './airco-adapter-registry';

export class AircoMqttBridgeService {
  private topics: MqttTopics;
  private client?: mqtt.MqttClient;
  private airco: AircoAdapter;

  private running = true;
  private lastVirtualTempSignature: string | null = null;

  constructor(
    private settings: RuntimeSettings,
    registry: AircoAdapterRegistry,
  ) {
    this.topics = createTopics(settings);
    this.airco = registry.create(settings.airco.type, {
      host: settings.airco.host,
      port: settings.airco.port,
      timeoutMs: CONFIG.airco.requestTimeoutMs,
      type: settings.airco.type,
      model: settings.airco.model,
      bidirectional: settings.airco.bidirectional,
      roomTemparatureAddress: settings.airco.roomTemparatureAddress,
      roomTemparatureSetPointAddress:
        settings.airco.roomTemparatureSetPointAddress,
      fanspeedAddress: settings.airco.fanspeedAddress,
      fanspeedSetPointAddress: settings.airco.fanspeedSetPointAddress,
    });
  }

  async start(): Promise<void> {
    await this.airco.connect();
    await this.connectMqtt();

    log(
      `airco mqtt bridge started type=${this.settings.airco.type} airco=${this.settings.airco.host}:${this.settings.airco.port} commandTopic=${this.topics.setTemperatureSet}`,
    );

    void this.virtualTempLoop();
  }

  async stop(): Promise<void> {
    this.running = false;

    try {
      this.client?.end(true);
    } catch {
      // ignore
    }

    await this.airco.disconnect();
  }

  private async connectMqtt(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(this.settings.mqtt.broker);
      this.client = client;

      client.once('connect', () => {
        log(`airco bridge mqtt connected with ${this.settings.mqtt.broker}`);

        client.subscribe(
          [
            this.topics.setTemperatureSet,
            this.topics.fanModeSet,
            this.topics.fanSpeedSet,
          ],
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            log('airco bridge subscribes on command topics');
            resolve();
          },
        );
      });

      client.once('error', reject);

      client.on('error', (error) => {
        log(`airco bridge mqtt error: ${formatError(error)}`);
      });

      client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload).catch((error) => {
          log(
            `airco bridge message error topic=${topic}: ${formatError(error)}`,
          );
        });
      });
    });
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    const value = toNumber(payload);

    if (value === null) {
      log(`invalid mqtt payload topic=${topic} payload=${payload.toString()}`);
      return;
    }

    if (topic === this.topics.setTemperatureSet) {
      await this.handleSetTemperature(value);
      return;
    }

    if (topic === this.topics.fanModeSet) {
      await this.handleFanMode(value);
      return;
    }

    if (topic === this.topics.fanSpeedSet) {
      await this.handleFanSpeed(value);
      return;
    }
  }

  private async handleSetTemperature(value: number): Promise<void> {
    const temperature = round1(value);

    log(`airco received setTemperature=${temperature} via mqtt `);

    await this.safeWrite(() =>
      this.airco.setSetpoint(
        this.settings.airco.unitId,
        this.settings.airco.zone,
        temperature,
      ),
    );

    this.publishState(this.topics.setTemperatureState, temperature);
  }

  private async handleFanMode(value: number): Promise<void> {
    const fanMode = normalizeFanMode(value);

    log(`airco received fanMode=${fanMode} via mqtt`);

    await this.safeWrite(() =>
      this.airco.setFanMode(
        this.settings.airco.unitId,
        this.settings.airco.zone,
        fanMode,
      ),
    );

    this.publishState(this.topics.fanModeState, fanMode);
  }

  private async handleFanSpeed(value: number): Promise<void> {
    log(`airco received fanSpeed=${value} via mqtt`);

    await this.safeWrite(() =>
      this.airco.setFanSpeed(
        this.settings.airco.unitId,
        this.settings.airco.zone,
        value,
      ),
    );

    this.publishState(this.topics.fanSpeedState, value);
  }

  private async virtualTempLoop(): Promise<void> {
    while (this.running) {
      try {
        const value = await this.airco.getVirtualTemperature(
          this.settings.airco.unitId,
          this.settings.airco.zone,
        );

        const rounded = roundHalf(value);
        const signature = virtualTempSignature(rounded);

        if (signature !== this.lastVirtualTempSignature) {
          this.lastVirtualTempSignature = signature;
          this.publishState(this.topics.virtualTempState, rounded);
        }
      } catch (error) {
        log(`airco virtualTemp lezen mislukt: ${formatError(error)}`);
      }

      await sleep(CONFIG.airco.virtualTempPollIntervalMs);
    }
  }

  private publishState(topic: string, value: number): void {
    this.client?.publish(topic, String(value), {
      retain: CONFIG.mqtt.retainStates,
    });

    log(`mqtt state publish ${topic}=${value}`);
  }

  private async safeWrite(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      if (isTimeoutError(error)) {
        log('airco write timeout, maybe received');
        return;
      }

      log(`airco write error: ${formatError(error)}`);
    }
  }
}
