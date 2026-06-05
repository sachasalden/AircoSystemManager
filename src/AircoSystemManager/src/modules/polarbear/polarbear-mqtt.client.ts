import * as mqtt from "mqtt";
import { CONFIG, TOPICS } from "../../config/runtime.config";
import type { PolarbearMqttHandlers } from "../../types/shared.types";
import { formatError, log, normalizeFanMode, round1, roundHalf, toNumber } from "../../utils/helpers";

export class PolarbearMqttClient {
  private client?: mqtt.MqttClient;
  private handlers: PolarbearMqttHandlers;

  constructor(
    private broker: string,
    handlers: PolarbearMqttHandlers,
  ) {
    this.handlers = handlers;
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(this.broker);
      this.client = client;

      client.once("connect", () => {
        log(`polarbear mqtt connected with ${this.broker}`);

        client.subscribe(
          [
            TOPICS.virtualTempState,
            TOPICS.setTemperatureState,
            TOPICS.fanModeState,
            TOPICS.fanSpeedState,
            TOPICS.setTemperatureSet,
            TOPICS.fanModeSet,
            TOPICS.fanSpeedSet,
          ],
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            log("polarbear mqtt subscribes on state and command topics");
            resolve();
          },
        );
      });

      client.once("error", reject);

      client.on("error", (error) => {
        log(`polarbear mqtt error: ${formatError(error)}`);
      });

      client.on("message", (topic, payload) => {
        this.handleMessage(topic, payload);
      });
    });
  }

  close(): void {
    try {
      this.client?.end(true);
    } catch {
      // ignore
    }
  }

  publishSetTemperatureCommand(value: number): void {
    this.publishCommand(TOPICS.setTemperatureSet, round1(value));
  }

  publishFanModeCommand(value: number): void {
    this.publishCommand(TOPICS.fanModeSet, normalizeFanMode(value));
  }

  publishFanSpeedCommand(value: number): void {
    this.publishCommand(TOPICS.fanSpeedSet, value);
  }

  private handleMessage(topic: string, payload: Buffer): void {
    const value = toNumber(payload);

    if (value === null) {
      log(
        `invalid polarbear mqtt payload topic=${topic} payload=${payload.toString()}`,
      );
      return;
    }

    if (topic === TOPICS.virtualTempState) {
      this.handlers.onVirtualTemperature(roundHalf(value));
      return;
    }

    if (topic === TOPICS.setTemperatureState) {
      this.handlers.onSetTemperatureState(round1(value));
      return;
    }

    if (topic === TOPICS.fanModeState) {
      this.handlers.onFanModeState(normalizeFanMode(value));
      return;
    }

    if (topic === TOPICS.fanSpeedState) {
      this.handlers.onFanSpeedState(Math.round(value));
      return;
    }

    if (topic === TOPICS.setTemperatureSet) {
      this.handlers.onSetTemperatureCommand(round1(value));
      return;
    }

    if (topic === TOPICS.fanModeSet) {
      this.handlers.onFanModeCommand(normalizeFanMode(value));
      return;
    }

    if (topic === TOPICS.fanSpeedSet) {
      this.handlers.onFanSpeedCommand(Math.round(value));
    }
  }

  private publishCommand(topic: string, value: number): void {
    this.client?.publish(topic, String(value), {
      retain: CONFIG.mqtt.retainCommands,
    });

    log(`mqtt command publish ${topic}=${value}`);
  }
}

