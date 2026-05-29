import { CONFIG } from "../../config/runtime.config";
import type { Candidate, FlagType, MqttWallpanelCommand, SetpointCache, SuppressedWrite, Unit, Zone } from "../../types/shared.types";
import { candidateKey, fanSignature, formatError, hasFlag, isTimeoutError, log, normalizeFanMode, round1, roundHalf, setpointSignature, sleep, sourceKey, virtualTempSignature, virtualTempTargetKey } from "../../utils/helpers";
import { ModbusClient } from "../modbus/modbus.client";
import { PolarbearService } from "./polarbear.service";
import { PolarbearMqttClient } from "./polarbear-mqtt.client";

export class WallpanelPollerService {
  private client = new ModbusClient(
    CONFIG.wallpanel.timeoutMs,
    CONFIG.wallpanel.requestGapMs,
  );

  private polarbear = new PolarbearService(this.client);

  private mqttClient = new PolarbearMqttClient({
    onVirtualTemperature: (value) => this.queueVirtualTemperatureFromMqtt(value),
    onSetTemperatureCommand: (value) => this.queueSetpointCommandFromMqtt(value),
    onFanModeCommand: (value) => this.queueFanModeCommandFromMqtt(value),
    onFanSpeedCommand: (value) => this.queueFanSpeedCommandFromMqtt(value),
    onSetTemperatureState: (value) => this.rememberSetpointStateFromMqtt(value),
    onFanModeState: (value) => this.rememberFanModeStateFromMqtt(value),
    onFanSpeedState: (value) => this.rememberFanSpeedStateFromMqtt(value),
  });

  private candidates = new Map<string, Candidate>();
  private setpointCache = new Map<string, SetpointCache>();
  private suppressedWrites = new Map<string, SuppressedWrite>();
  private lastWrittenVirtualTemp = new Map<string, string>();
  private pendingMqttCommands = new Map<string, MqttWallpanelCommand>();
  private mqttCommandFlushRunning = false;

  /**
   * MQTT doesn't write directly to Modbus.
   * We only save the last value.
   */
  private latestVirtualTempFromMqtt: number | null = null;
  private latestSetpointStateFromMqtt: number | null = null;
  private latestFanModeStateFromMqtt: number | null = null;
  private latestFanSpeedStateFromMqtt: number | null = null;
  private virtualTempDirty = false;
  private virtualTempFlushRunning = false;

  private running = true;
  private pollPaused = false;
  private pollCycleRunning = false;

  async start(): Promise<void> {
    await this.client.connect(CONFIG.wallpanel.host, CONFIG.wallpanel.port);

    log(
      `polarbear publisher gestart ${CONFIG.wallpanel.host}:${CONFIG.wallpanel.port} debounce=${CONFIG.wallpanel.debounceMs}ms`,
    );

    await this.clearStartupFlags();
    await this.initializeSetpointCache();

    /**
     * after startup/cache subscribe on virtualTemp,
     * so retained MQTT doesn't put old values to startup-cache.
     */
    await this.mqttClient.connect();

    while (this.running) {
      if (this.pollPaused) {
        await sleep(CONFIG.wallpanel.pollIntervalMs);
        continue;
      }

      this.pollCycleRunning = true;

      try {
        await this.poll();
        await this.flushMqttCommands();
        await this.processCandidates();

        /**
         * Only write the Virtualtemp after the wallpanel-sync.
         */
        await this.flushVirtualTempIfWallpanelIdle();
      } finally {
        this.pollCycleRunning = false;
      }

      await sleep(CONFIG.wallpanel.pollIntervalMs);
    }
  }

  async rebootPolarbears(unitIds: number[]): Promise<void> {
    await this.polarbear.reboot(unitIds);
  }

  async setPolarbearBaudrate(
    unitIds: number[],
    baudrate: number,
  ): Promise<void> {
    await this.polarbear.setBaudrate(unitIds, baudrate);
  }

  getPolarbearLoopStatus(): { paused: boolean } {
    return {
      paused: this.pollPaused,
    };
  }

  async pausePolarbearLoop(): Promise<void> {
    if (this.pollPaused) {
      return;
    }

    this.pollPaused = true;
    await this.waitForPollIdle();
    log("polarbear poll-loop gepauzeerd, modbus stays open");
  }

  async resumePolarbearLoop(): Promise<void> {
    if (!this.pollPaused) {
      return;
    }

    log("polarbear poll-loop continues: mqtt state first to polarbears");
    await this.syncLatestMqttStateToPolarbears();
    await this.initializeSetpointCache();
    this.pollPaused = false;
    log("polarbear poll-loop hervat");
  }

  private async waitForPollIdle(): Promise<void> {
    while (this.pollCycleRunning) {
      await sleep(25);
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    this.mqttClient.close();
    await this.client.close();
  }

  private async poll(): Promise<void> {
    for (const unit of CONFIG.wallpanel.units) {
      let flags: number;

      try {
        flags = await this.polarbear.getFlags(unit.id);
      } catch (error) {
        log(`flags read failed unit=${unit.id}: ${formatError(error)}`);
        continue;
      }

      for (const zone of unit.zones) {
        const setpointCache = await this.updateSetpointCache(unit, zone);

        if (hasFlag(flags, zone, "setpoint")) {
          await this.consumeSetpointFlag(unit, zone, flags, setpointCache);
        }

        if (hasFlag(flags, zone, "fanMode")) {
          await this.consumeFanFlag(unit, zone, flags);
        }
      }
    }
  }

  private async initializeSetpointCache(): Promise<void> {
    for (const unit of CONFIG.wallpanel.units) {
      for (const zone of unit.zones) {
        await this.updateSetpointCache(unit, zone);
      }
    }

    log("setpoint-cache ready");
  }

  private async updateSetpointCache(
    unit: Unit,
    zone: Zone,
  ): Promise<SetpointCache> {
    const key = sourceKey(unit.id, zone, "setpoint");
    const previous = this.setpointCache.get(key);

    try {
      const value = await this.polarbear.getPendingSetpoint(unit.id, zone);
      const signature = setpointSignature(value);

      if (!previous || previous.signature !== signature) {
        const next = {
          value,
          signature,
          changedAt: Date.now(),
        };

        this.setpointCache.set(key, next);

        log(
          `pending setpoint changed unit=${unit.id} zone=${zone} ${previous?.signature ?? "none"} -> ${signature}`,
        );

        return next;
      }

      return previous;
    } catch (error) {
      log(`pending setpoint read failed unit=${unit.id}: ${formatError(error)}`);

      return (
        previous ?? {
          value: 0,
          signature: "setpoint:0",
          changedAt: 0,
        }
      );
    }
  }

  private async consumeSetpointFlag(
    unit: Unit,
    zone: Zone,
    flags: number,
    cache: SetpointCache,
  ): Promise<void> {
    await this.safeClearFlag(unit.id, zone, "setpoint", flags);

    if (this.shouldIgnoreOwnWrite(unit.id, zone, "setpoint", cache.signature)) {
      log(`ignore own setpoint unit=${unit.id} zone=${zone} value=${cache.value}`);
      return;
    }

    const key = candidateKey(zone, "setpoint");
    const existing = this.candidates.get(key);

    if (
      existing &&
      existing.type === "setpoint" &&
      existing.sourceUnitId !== unit.id &&
      cache.changedAt < existing.changedAt
    ) {
      log(
        `stale setpoint ignored unit=${unit.id} zone=${zone} value=${cache.value}`,
      );
      return;
    }

    if (existing && existing.type === "setpoint") {
      log(
        `candidate overwritten zone=${zone}: unit=${existing.sourceUnitId} value=${existing.value} -> unit=${unit.id} value=${cache.value}`,
      );
    }

    this.candidates.set(key, {
      type: "setpoint",
      sourceUnitId: unit.id,
      zone,
      value: cache.value,
      signature: cache.signature,
      changedAt: cache.changedAt,
      createdAt: Date.now(),
    });

    log(`candidate setpoint unit=${unit.id} zone=${zone} value=${cache.value}`);
  }

  private async consumeFanFlag(
    unit: Unit,
    zone: Zone,
    flags: number,
  ): Promise<void> {
    try {
      const fanMode = await this.polarbear.getPendingFanMode(unit.id, zone);
      const fanSpeed = await this.polarbear.getFanSpeed(unit.id, zone);
      const signature = fanSignature(fanMode, fanSpeed);

      await this.safeClearFlag(unit.id, zone, "fanMode", flags);

      if (this.shouldIgnoreOwnWrite(unit.id, zone, "fanMode", signature)) {
        log(`ignore own fan unit=${unit.id} zone=${zone}`);
        return;
      }

      const key = candidateKey(zone, "fanMode");
      const existing = this.candidates.get(key);

      if (existing && existing.type === "fanMode") {
        log(
          `candidate fan overwritten zone=${zone}: unit=${existing.sourceUnitId} mode=${existing.fanMode} speed=${existing.fanSpeed} -> unit=${unit.id} mode=${fanMode} speed=${fanSpeed}`,
        );
      }

      this.candidates.set(key, {
        type: "fanMode",
        sourceUnitId: unit.id,
        zone,
        fanMode,
        fanSpeed,
        signature,
        changedAt: Date.now(),
        createdAt: Date.now(),
      });

      log(
        `candidate fan unit=${unit.id} zone=${zone} mode=${fanMode} speed=${fanSpeed}`,
      );
    } catch (error) {
      log(`fan process failed unit=${unit.id}: ${formatError(error)}`);
    }
  }

  private async processCandidates(): Promise<void> {
    const now = Date.now();

    for (const [key, candidate] of Array.from(this.candidates.entries())) {
      const ageMs = now - candidate.createdAt;

      if (ageMs < CONFIG.wallpanel.debounceMs) {
        continue;
      }

      log(
        `candidate processing type=${candidate.type} source=${candidate.sourceUnitId} zone=${candidate.zone} ageMs=${ageMs}`,
      );

      await this.syncCandidate(candidate);
      this.candidates.delete(key);
    }
  }

  private async syncCandidate(candidate: Candidate): Promise<void> {
    for (const target of CONFIG.wallpanel.units) {
      if (target.id === candidate.sourceUnitId) continue;
      if (!target.zones.includes(candidate.zone)) continue;

      if (candidate.type === "setpoint") {
        log(
          `sync setpoint ${candidate.value} zone=${candidate.zone}: ${candidate.sourceUnitId} -> ${target.id}`,
        );

        this.suppressOwnWrite(
          target.id,
          candidate.zone,
          "setpoint",
          candidate.signature,
        );

        await this.safeWrite(() =>
          this.polarbear.setSetpoint(target.id, candidate.zone, candidate.value),
        );

        continue;
      }

      log(
        `sync fan zone=${candidate.zone}: ${candidate.sourceUnitId} -> ${target.id} mode=${candidate.fanMode} speed=${candidate.fanSpeed}`,
      );

      this.suppressOwnWrite(
        target.id,
        candidate.zone,
        "fanMode",
        candidate.signature,
      );

      await this.safeWrite(() =>
        this.polarbear.setFanMode(target.id, candidate.zone, candidate.fanMode),
      );

      await this.safeWrite(() =>
        this.polarbear.setFanSpeed(target.id, candidate.zone, candidate.fanSpeed),
      );
    }

    if (candidate.type === "setpoint") {
      log(`final setTemperature to mqtt=${candidate.value}`);
      this.mqttClient.publishSetTemperatureCommand(candidate.value);
      return;
    }

    log(
      `final fan to mqtt mode=${candidate.fanMode} speed=${candidate.fanSpeed}`,
    );

    this.mqttClient.publishFanModeCommand(candidate.fanMode);
    this.mqttClient.publishFanSpeedCommand(candidate.fanSpeed);
  }

  private queueVirtualTemperatureFromMqtt(value: number): void {
    const rounded = roundHalf(value);

    /**
     * important:
     * MQTT handler doesn't write to Modbus.
     * it only saves the last value.
     */
    this.latestVirtualTempFromMqtt = rounded;
    this.virtualTempDirty = true;

    log(`virtualTemp queued from mqtt value=${value} rounded=${rounded}`);
  }

  private rememberSetpointStateFromMqtt(value: number): void {
    const temperature = round1(value);
    this.latestSetpointStateFromMqtt = temperature;

    if (this.pollPaused) {
      log(`setpoint state saved while on pause value=${temperature}`);
    }
  }

  private rememberFanModeStateFromMqtt(value: number): void {
    const fanMode = normalizeFanMode(value);
    this.latestFanModeStateFromMqtt = fanMode;

    if (this.pollPaused) {
      log(`fanMode state saved while on pause value=${fanMode}`);
    }
  }

  private rememberFanSpeedStateFromMqtt(value: number): void {
    const fanSpeed = Math.round(value);
    this.latestFanSpeedStateFromMqtt = fanSpeed;

    if (this.pollPaused) {
      log(`fanSpeed state bewaard tijdens pauze value=${fanSpeed}`);
    }
  }

  private async syncLatestMqttStateToPolarbears(): Promise<void> {
    if (this.latestSetpointStateFromMqtt !== null) {
      this.queueSetpointCommandFromMqtt(this.latestSetpointStateFromMqtt);
    }

    if (this.latestFanModeStateFromMqtt !== null) {
      this.queueFanModeCommandFromMqtt(this.latestFanModeStateFromMqtt);
    }

    if (this.latestFanSpeedStateFromMqtt !== null) {
      this.queueFanSpeedCommandFromMqtt(this.latestFanSpeedStateFromMqtt);
    }

    await this.flushMqttCommands();
    await this.flushVirtualTempIfWallpanelIdle();
  }

  private queueSetpointCommandFromMqtt(value: number): void {
    const zone = CONFIG.airco.zone;
    const temperature = round1(value);
    const signature = setpointSignature(temperature);

    this.pendingMqttCommands.set(`mqtt:${zone}:setpoint`, {
      type: "setpoint",
      zone,
      value: temperature,
      signature,
      createdAt: Date.now(),
    });

    log(`setpoint command queued from mqtt zone=${zone} value=${temperature}`);
  }

  private queueFanModeCommandFromMqtt(value: number): void {
    const zone = CONFIG.airco.zone;
    const fanMode = normalizeFanMode(value);

    this.pendingMqttCommands.set(`mqtt:${zone}:fanMode`, {
      type: "fanMode",
      zone,
      value: fanMode,
      createdAt: Date.now(),
    });

    log(`fanMode command queued from mqtt zone=${zone} value=${fanMode}`);
  }

  private queueFanSpeedCommandFromMqtt(value: number): void {
    const zone = CONFIG.airco.zone;
    const fanSpeed = Math.round(value);

    this.pendingMqttCommands.set(`mqtt:${zone}:fanSpeed`, {
      type: "fanSpeed",
      zone,
      value: fanSpeed,
      createdAt: Date.now(),
    });

    log(`fanSpeed command queued from mqtt zone=${zone} value=${fanSpeed}`);
  }

  private async flushMqttCommands(): Promise<void> {
    if (this.mqttCommandFlushRunning || this.pendingMqttCommands.size === 0) {
      return;
    }

    this.mqttCommandFlushRunning = true;

    try {
      const commands = Array.from(this.pendingMqttCommands.values()).sort(
        (left, right) => left.createdAt - right.createdAt,
      );

      this.pendingMqttCommands.clear();

      for (const command of commands) {
        await this.applyMqttCommandToPolarbears(command);
      }
    } finally {
      this.mqttCommandFlushRunning = false;
    }
  }

  private async applyMqttCommandToPolarbears(
    command: MqttWallpanelCommand,
  ): Promise<void> {
    if (!this.mqttCommandWinsOverPendingPanelChange(command)) {
      return;
    }

    if (command.type === "setpoint") {
      await this.applyMqttSetpointToPolarbears(command);
      return;
    }

    if (command.type === "fanMode") {
      await this.applyMqttFanModeToPolarbears(command);
      return;
    }

    await this.applyMqttFanSpeedToPolarbears(command);
  }

  private mqttCommandWinsOverPendingPanelChange(
    command: MqttWallpanelCommand,
  ): boolean {
    const key =
      command.type === "setpoint"
        ? candidateKey(command.zone, "setpoint")
        : candidateKey(command.zone, "fanMode");
    const pendingPanelChange = this.candidates.get(key);

    if (!pendingPanelChange) {
      return true;
    }

    if (pendingPanelChange.changedAt > command.createdAt) {
      log(
        `mqtt command skipped cause panel is newer type=${command.type} zone=${command.zone}`,
      );
      return false;
    }

    this.candidates.delete(key);

    log(
      `mqtt command wins from panel candidate type=${command.type} zone=${command.zone}`,
    );

    return true;
  }

  private async applyMqttSetpointToPolarbears(
    command: Extract<MqttWallpanelCommand, { type: "setpoint" }>,
  ): Promise<void> {
    log(`mqtt setpoint to polarbears zone=${command.zone} value=${command.value}`);

    for (const unit of CONFIG.wallpanel.units) {
      if (!unit.zones.includes(command.zone)) {
        continue;
      }

      this.suppressOwnWrite(
        unit.id,
        command.zone,
        "setpoint",
        command.signature,
      );

      this.setpointCache.set(sourceKey(unit.id, command.zone, "setpoint"), {
        value: command.value,
        signature: command.signature,
        changedAt: Date.now(),
      });

      await this.safeWrite(() =>
        this.polarbear.setSetpoint(unit.id, command.zone, command.value),
      );
    }
  }

  private async applyMqttFanModeToPolarbears(
    command: Extract<MqttWallpanelCommand, { type: "fanMode" }>,
  ): Promise<void> {
    log(`mqtt fanMode to polarbears zone=${command.zone} value=${command.value}`);

    for (const unit of CONFIG.wallpanel.units) {
      if (!unit.zones.includes(command.zone)) {
        continue;
      }

      const fanSpeed = await this.readFanSpeedForSignature(unit.id, command.zone);

      this.suppressOwnWrite(
        unit.id,
        command.zone,
        "fanMode",
        fanSignature(command.value, fanSpeed),
      );

      await this.safeWrite(() =>
        this.polarbear.setFanMode(unit.id, command.zone, command.value),
      );
    }
  }

  private async applyMqttFanSpeedToPolarbears(
    command: Extract<MqttWallpanelCommand, { type: "fanSpeed" }>,
  ): Promise<void> {
    log(`mqtt fanSpeed to polarbears zone=${command.zone} value=${command.value}`);

    for (const unit of CONFIG.wallpanel.units) {
      if (!unit.zones.includes(command.zone)) {
        continue;
      }

      const fanMode = await this.readFanModeForSignature(unit.id, command.zone);

      this.suppressOwnWrite(
        unit.id,
        command.zone,
        "fanMode",
        fanSignature(fanMode, command.value),
      );

      await this.safeWrite(() =>
        this.polarbear.setFanSpeed(unit.id, command.zone, command.value),
      );
    }
  }

  private async readFanSpeedForSignature(unitId: number, zone: Zone): Promise<number> {
    try {
      return await this.polarbear.getFanSpeed(unitId, zone);
    } catch (error) {
      log(`fanSpeed lezen voor mqtt suppress mislukt unit=${unitId}: ${formatError(error)}`);
      return 0;
    }
  }

  private async readFanModeForSignature(unitId: number, zone: Zone): Promise<number> {
    try {
      return await this.polarbear.getPendingFanMode(unitId, zone);
    } catch (error) {
      log(`fanMode lezen voor mqtt suppress mislukt unit=${unitId}: ${formatError(error)}`);
      return 1;
    }
  }

  private async flushVirtualTempIfWallpanelIdle(): Promise<void> {
    if (!this.virtualTempDirty) {
      return;
    }

    if (this.latestVirtualTempFromMqtt === null) {
      return;
    }

    if (this.virtualTempFlushRunning) {
      return;
    }

    /**
     * if there is a setpoint/fan candidate active,
     * don't write a virtualTemperature.
     */
    if (this.candidates.size > 0) {
      log("virtualTemp postponed cause wallpanel-sync has a active candidate");
      return;
    }

    this.virtualTempFlushRunning = true;

    try {
      const valueToWrite = this.latestVirtualTempFromMqtt;

      /**
       * This value is getting processed.
       * If while writing a mqtt value comes in,
       * set queueVirtualTemperatureFromMqtt virtualTempDirty true.
       */
      this.virtualTempDirty = false;

      await this.writeVirtualTemperatureAfterWallpanelSync(valueToWrite);
    } finally {
      this.virtualTempFlushRunning = false;
    }
  }

  private async writeVirtualTemperatureAfterWallpanelSync(
    value: number,
  ): Promise<void> {
    const rounded = roundHalf(value);
    const signature = virtualTempSignature(rounded);

    log(`virtualTemp write to wallpanel-sync rounded=${rounded}`);

    for (
      let index = 0;
      index < CONFIG.wallpanel.virtualTemperatureTargets.length;
      index++
    ) {
      const target = CONFIG.wallpanel.virtualTemperatureTargets[index];
      const key = virtualTempTargetKey(target);

      if (this.lastWrittenVirtualTemp.get(key) === signature) {
        continue;
      }

      try {
        /**
         * VirtualTemp may cause setpoint flags/pending changes.
         * that's why we suppress the own write.
         */
        this.suppressOwnWrite(
          target.unitId,
          target.zone,
          "setpoint",
          setpointSignature(rounded),
        );

        await this.polarbear.setVirtualTemperature(target, rounded);
        this.lastWrittenVirtualTemp.set(key, signature);
      } catch (error) {
        log(
          `virtualTemp write error ${target.name} unit=${target.unitId} zone=${target.zone} register=${target.register}: ${formatError(error)}`,
        );
      }

      if (index < CONFIG.wallpanel.virtualTemperatureTargets.length - 1) {
        await sleep(CONFIG.wallpanel.virtualTempWriteGapMs);
      }
    }
  }

  private async clearStartupFlags(): Promise<void> {
    for (const unit of CONFIG.wallpanel.units) {
      let flags: number;

      try {
        flags = await this.polarbear.getFlags(unit.id);
      } catch {
        continue;
      }

      for (const zone of unit.zones) {
        if (hasFlag(flags, zone, "setpoint")) {
          flags = await this.safeClearFlag(unit.id, zone, "setpoint", flags);
        }

        if (hasFlag(flags, zone, "fanMode")) {
          flags = await this.safeClearFlag(unit.id, zone, "fanMode", flags);
        }
      }
    }

    log("startup flags deleted");
  }

  private async safeClearFlag(
    unitId: number,
    zone: Zone,
    type: FlagType,
    flags?: number,
  ): Promise<number> {
    try {
      return await this.polarbear.clearFlag(unitId, zone, type, flags);
    } catch (error) {
      if (!isTimeoutError(error)) {
        log(
          `flag clear error unit=${unitId} zone=${zone} type=${type}: ${formatError(error)}`,
        );
      }

      return flags ?? 0;
    }
  }

  private async safeWrite(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      if (isTimeoutError(error)) {
        log("write timeout, maybe received");
        return;
      }

      log(`write error: ${formatError(error)}`);
    }
  }

  private suppressOwnWrite(
    unitId: number,
    zone: Zone,
    type: FlagType,
    signature: string,
  ): void {
    this.suppressedWrites.set(sourceKey(unitId, zone, type), {
      signature,
      until: Date.now() + CONFIG.wallpanel.suppressOwnWriteMs,
    });
  }

  private shouldIgnoreOwnWrite(
    unitId: number,
    zone: Zone,
    type: FlagType,
    signature: string,
  ): boolean {
    const key = sourceKey(unitId, zone, type);
    const suppressed = this.suppressedWrites.get(key);

    if (!suppressed) return false;

    if (Date.now() > suppressed.until) {
      this.suppressedWrites.delete(key);
      return false;
    }

    if (suppressed.signature !== signature) {
      return false;
    }

    this.suppressedWrites.delete(key);
    return true;
  }
}
