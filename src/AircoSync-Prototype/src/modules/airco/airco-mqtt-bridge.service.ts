import * as mqtt from "mqtt";
import { CONFIG, TOPICS } from "../../config/runtime.config";
import { formatError, isTimeoutError, log, normalizeFanMode, round1, roundHalf, sleep, toNumber, virtualTempSignature } from "../../utils/helpers";
import { HopmannAdapterService } from "./hopmann-adapter.service";

export class AircoMqttBridgeService {
  private client?: mqtt.MqttClient;

  private airco = new HopmannAdapterService({
    host: CONFIG.airco.host,
    port: CONFIG.airco.port,
    model: CONFIG.airco.model,
    bidirectional: CONFIG.airco.bidirectional,
  });

  private running = true;
  private lastVirtualTempSignature: string | null = null;

  async start(): Promise<void> {
    await this.airco.connect();
    await this.connectMqtt();

    log(`airco mqtt bridge gestart airco=${CONFIG.airco.host}:${CONFIG.airco.port}`);

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
      const client = mqtt.connect(CONFIG.mqtt.broker);
      this.client = client;

      client.once("connect", () => {
        log(`airco bridge mqtt verbonden met ${CONFIG.mqtt.broker}`);

        client.subscribe(
          [TOPICS.setTemperatureSet, TOPICS.fanModeSet, TOPICS.fanSpeedSet],
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            log("airco bridge subscribed op command topics");
            resolve();
          },
        );
      });

      client.once("error", reject);

      client.on("error", (error) => {
        log(`airco bridge mqtt error: ${formatError(error)}`);
      });

      client.on("message", (topic, payload) => {
        this.handleMessage(topic, payload).catch((error) => {
          log(`airco bridge message error topic=${topic}: ${formatError(error)}`);
        });
      });
    });
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    const value = toNumber(payload);

    if (value === null) {
      log(`ongeldige mqtt payload topic=${topic} payload=${payload.toString()}`);
      return;
    }

    if (topic === TOPICS.setTemperatureSet) {
      await this.handleSetTemperature(value);
      return;
    }

    if (topic === TOPICS.fanModeSet) {
      await this.handleFanMode(value);
      return;
    }

    if (topic === TOPICS.fanSpeedSet) {
      await this.handleFanSpeed(value);
      return;
    }
  }

  private async handleSetTemperature(value: number): Promise<void> {
    const temperature = round1(value);

    log(`airco ontvangt via mqtt setTemperature=${temperature}`);

    await this.safeWrite(() =>
      this.airco.setSetpoint(CONFIG.airco.unitId, CONFIG.airco.zone, temperature),
    );

    this.publishState(TOPICS.setTemperatureState, temperature);
  }

  private async handleFanMode(value: number): Promise<void> {
    const fanMode = normalizeFanMode(value);

    log(`airco ontvangt via mqtt fanMode=${fanMode}`);

    await this.safeWrite(() =>
      this.airco.setFanMode(CONFIG.airco.unitId, CONFIG.airco.zone, fanMode),
    );

    this.publishState(TOPICS.fanModeState, fanMode);
  }

  private async handleFanSpeed(value: number): Promise<void> {
    log(`airco ontvangt via mqtt fanSpeed=${value}`);

    await this.safeWrite(() =>
      this.airco.setFanSpeed(CONFIG.airco.unitId, CONFIG.airco.zone, value),
    );

    this.publishState(TOPICS.fanSpeedState, value);
  }

  private async virtualTempLoop(): Promise<void> {
    while (this.running) {
      try {
        const value = await this.airco.getVirtualTemperature(
          CONFIG.airco.unitId,
          CONFIG.airco.zone,
        );

        const rounded = roundHalf(value);
        const signature = virtualTempSignature(rounded);

        if (signature !== this.lastVirtualTempSignature) {
          this.lastVirtualTempSignature = signature;
          this.publishState(TOPICS.virtualTempState, rounded);
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
        log("airco write timeout, mogelijk wel aangekomen");
        return;
      }

      log(`airco write error: ${formatError(error)}`);
    }
  }
}
