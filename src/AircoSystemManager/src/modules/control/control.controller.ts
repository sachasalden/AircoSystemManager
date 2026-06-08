import * as mqtt from 'mqtt';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { URL } from 'node:url';
import {
  BAUDRATE_VALUES,
  CONFIG,
  TOPICS,
  createTopics,
  type MqttTopics,
} from '../../config/runtime.config';
import { applyCorsHeaders } from '../../middleware/cors.middleware';
import type {
  DbAircoPanel,
  DbAirconditioner,
  EnvironmentAircoDeviceDocument,
  PolarbearInsightSnapshot,
  PolarbearAdminController,
  RuntimeSettings,
  SettingsPatch,
  SyncRoomRef,
} from '../../types/shared.types';
import {
  formatError,
  log,
  normalizeFanMode,
  parseCommandNumber,
  round1,
  toNumber,
} from '../../utils/helpers';
import type { AircoAdapterRegistry } from '../airco/airco-adapter-registry';
import { ConfigService } from '../config/config.service';
import { CONTROL_PATHS } from './control.routes';
import type { NumericState } from './control.types';

export class ControlController {
  private server?: Server;
  private client?: mqtt.MqttClient;
  private mqttConnected = false;
  private state: Record<string, NumericState> = {};
  private configStore: ConfigService;
  private aircoAdapterRegistry: AircoAdapterRegistry;
  private polarbearAdmin?: PolarbearAdminController;

  constructor(
    configStore: ConfigService,
    aircoAdapterRegistry: AircoAdapterRegistry,
    private settings: RuntimeSettings,
    polarbearAdmin?: PolarbearAdminController,
  ) {
    this.configStore = configStore;
    this.aircoAdapterRegistry = aircoAdapterRegistry;
    this.polarbearAdmin = polarbearAdmin;
  }

  async start(): Promise<void> {
    await this.connectMqtt();

    this.server = createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        log(`control http error: ${formatError(error)}`);
        this.sendJson(response, 500, {
          ok: false,
          error: formatError(error),
          message: formatError(error),
        });
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(CONFIG.control.port, CONFIG.control.host, () => {
        log(
          `control frontend gestart http://${CONFIG.control.host}:${CONFIG.control.port}`,
        );
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    try {
      this.client?.end(true);
    } catch {
      // ignore
    }

    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });
  }

  private async connectMqtt(): Promise<void> {
    const settingsList = await this.configStore.getAllSettings();
    const subscribedTopics = Array.from(
      new Set(
        settingsList.flatMap((settings) => {
          const topics = createTopics(settings);

          return [
            topics.setTemperatureState,
            topics.fanModeState,
            topics.fanSpeedState,
            topics.virtualTempState,
          ];
        }),
      ),
    );

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(this.settings.mqtt.broker);
      this.client = client;

      client.once('connect', () => {
        this.mqttConnected = true;
        log(`control mqtt connected with ${this.settings.mqtt.broker}`);

        client.subscribe(subscribedTopics, (error) => {
          if (error) {
            reject(error);
            return;
          }

          log(
            `control subscribes on ${subscribedTopics.length} room state topic(s)`,
          );
          resolve();
        });
      });

      client.once('error', reject);

      client.on('close', () => {
        this.mqttConnected = false;
      });

      client.on('reconnect', () => {
        this.mqttConnected = false;
      });

      client.on('error', (error) => {
        log(`control mqtt error: ${formatError(error)}`);
      });

      client.on('message', (topic, payload) => {
        const value = toNumber(payload);

        if (value === null) {
          return;
        }

        this.state[topic] = {
          value,
          updatedAt: new Date().toISOString(),
        };
      });
    });
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    applyCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(
      request.url ?? CONTROL_PATHS.root,
      `http://${request.headers.host ?? 'localhost'}`,
    );

    if (request.method === 'GET' && url.pathname === CONTROL_PATHS.root) {
      this.sendJson(response, 200, {
        ok: true,
        message:
          'WallpanelAircoSync backend active. Use the React frontend from frontend/.',
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === CONTROL_PATHS.status) {
      this.sendJson(response, 200, {
        ok: true,
        mqttConnected: this.mqttConnected,
        broker: this.settings.mqtt.broker,
        topics: TOPICS,
        state: this.readableState(),
        polarbearLoop: this.polarbearAdmin?.getPolarbearLoopStatus() ?? null,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === CONTROL_PATHS.settings) {
      this.sendJson(response, 200, {
        ok: true,
        settings: await this.configStore.getSettings(),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === CONTROL_PATHS.devices) {
      this.sendJson(response, 200, await this.configStore.getFrontendZones());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/zones') {
      this.sendJson(
        response,
        201,
        await this.configStore.addZone(
          await this.readJsonRequest<{ name?: string }>(request),
        ),
      );
      return;
    }

    const zoneMatch = url.pathname.match(/^\/zones\/([^/]+)$/);
    if (zoneMatch && request.method === 'PUT') {
      this.sendJson(
        response,
        200,
        await this.configStore.updateZone(
          decodeURIComponent(zoneMatch[1]),
          await this.readJsonRequest<{ name?: string }>(request),
        ),
      );
      return;
    }

    if (zoneMatch && request.method === 'DELETE') {
      await this.configStore.deleteZone(decodeURIComponent(zoneMatch[1]));
      this.sendJson(response, 200, { ok: true });
      return;
    }

    const roomCollectionMatch = url.pathname.match(/^\/zones\/([^/]+)\/rooms$/);
    if (roomCollectionMatch && request.method === 'POST') {
      this.sendJson(
        response,
        201,
        await this.configStore.addRoom({
          ...(await this.readJsonRequest<{ name?: string }>(request)),
          zoneId: decodeURIComponent(roomCollectionMatch[1]),
        }),
      );
      return;
    }

    const roomMatch = url.pathname.match(/^\/zones\/([^/]+)\/rooms\/([^/]+)$/);
    if (roomMatch && request.method === 'PUT') {
      this.sendJson(
        response,
        200,
        await this.configStore.updateRoom(
          decodeURIComponent(roomMatch[1]),
          decodeURIComponent(roomMatch[2]),
          await this.readJsonRequest<{ name?: string }>(request),
        ),
      );
      return;
    }

    if (roomMatch && request.method === 'DELETE') {
      await this.configStore.deleteRoom(
        decodeURIComponent(roomMatch[1]),
        decodeURIComponent(roomMatch[2]),
      );
      this.sendJson(response, 200, { ok: true });
      return;
    }

    if (
      request.method === 'GET' &&
      url.pathname === CONTROL_PATHS.environmentDevices
    ) {
      this.sendJson(
        response,
        200,
        await this.configStore.getEnvironmentDevices(),
      );
      return;
    }

    if (
      request.method === 'POST' &&
      url.pathname === CONTROL_PATHS.environmentDevices
    ) {
      this.sendJson(
        response,
        201,
        await this.configStore.addEnvironmentDevice(
          await this.readJsonRequest<Partial<EnvironmentAircoDeviceDocument>>(
            request,
          ),
        ),
      );
      return;
    }

    const environmentDeviceMatch = url.pathname.match(
      /^\/environment-devices\/([^/]+)$/,
    );
    if (environmentDeviceMatch && request.method === 'PUT') {
      this.sendJson(
        response,
        200,
        await this.configStore.updateEnvironmentDevice(
          decodeURIComponent(environmentDeviceMatch[1]),
          await this.readJsonRequest<Partial<EnvironmentAircoDeviceDocument>>(
            request,
          ),
        ),
      );
      return;
    }

    if (environmentDeviceMatch && request.method === 'DELETE') {
      await this.configStore.deleteEnvironmentDevice(
        decodeURIComponent(environmentDeviceMatch[1]),
      );
      this.sendJson(response, 200, { ok: true });
      return;
    }

    if (
      request.method === 'GET' &&
      url.pathname === CONTROL_PATHS.aircoAdapterTypes
    ) {
      this.sendJson(
        response,
        200,
        this.aircoAdapterRegistry.listTypes().map((type) => ({ type })),
      );
      return;
    }

    if (request.method === 'POST' && url.pathname === CONTROL_PATHS.devices) {
      this.sendJson(
        response,
        201,
        await this.configStore.addPanel(
          await this.readJsonRequest<
            Partial<DbAircoPanel> & { zoneId: string; roomId: string }
          >(request),
        ),
      );
      return;
    }

    const panelMatch = url.pathname.match(/^\/devices\/([^/]+)$/);
    if (panelMatch && request.method === 'PUT') {
      this.sendJson(
        response,
        200,
        await this.configStore.updatePanel(
          decodeURIComponent(panelMatch[1]),
          await this.readJsonRequest<Partial<DbAircoPanel>>(request),
        ),
      );
      return;
    }

    if (panelMatch && request.method === 'DELETE') {
      await this.configStore.deletePanel(decodeURIComponent(panelMatch[1]));
      this.sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/airco-devices') {
      this.sendJson(
        response,
        201,
        await this.configStore.addAirconditioner(
          await this.readJsonRequest<
            Partial<DbAirconditioner> & { zoneId: string; roomId: string }
          >(request),
        ),
      );
      return;
    }

    const aircoDeviceMatch = url.pathname.match(/^\/airco-devices\/([^/]+)$/);
    if (aircoDeviceMatch && request.method === 'PUT') {
      this.sendJson(
        response,
        200,
        await this.configStore.updateAirconditioner(
          decodeURIComponent(aircoDeviceMatch[1]),
          await this.readJsonRequest<Partial<DbAirconditioner>>(request),
        ),
      );
      return;
    }

    if (aircoDeviceMatch && request.method === 'DELETE') {
      await this.configStore.deleteAirconditioner(
        decodeURIComponent(aircoDeviceMatch[1]),
      );
      this.sendJson(response, 200, { ok: true });
      return;
    }

    const wallpanelInsightsMatch = url.pathname.match(
      /^\/wallpanel-insights\/rooms\/([^/]+)\/([^/]+)$/,
    );
    if (wallpanelInsightsMatch && request.method === 'GET') {
      this.sendJson(
        response,
        200,
        await this.wallpanelInsightsResponse(
          decodeURIComponent(wallpanelInsightsMatch[1]),
          decodeURIComponent(wallpanelInsightsMatch[2]),
        ),
      );
      return;
    }

    const wallpanelStreamMatch = url.pathname.match(
      /^\/wallpanel-insights\/stream\/rooms\/([^/]+)\/([^/]+)$/,
    );
    if (wallpanelStreamMatch && request.method === 'GET') {
      await this.streamInsights(response, 'insights', () =>
        this.wallpanelInsightsResponse(
          decodeURIComponent(wallpanelStreamMatch[1]),
          decodeURIComponent(wallpanelStreamMatch[2]),
        ),
      );
      return;
    }

    const wallpanelRoomSyncMatch = url.pathname.match(
      /^\/wallpanel-insights\/rooms\/([^/]+)\/([^/]+)\/sync\/(status|pause|resume)$/,
    );
    if (wallpanelRoomSyncMatch) {
      const room = {
        zoneId: decodeURIComponent(wallpanelRoomSyncMatch[1]),
        roomId: decodeURIComponent(wallpanelRoomSyncMatch[2]),
      };
      const action = wallpanelRoomSyncMatch[3];

      if (request.method === 'GET' && action === 'status') {
        this.sendJson(response, 200, {
          polarbearLoop: this.polarbearLoopStatus(room),
        });
        return;
      }

      if (request.method === 'POST' && action === 'pause') {
        const polarbearAdmin = this.getPolarbearAdmin();
        await polarbearAdmin.pausePolarbearLoop(room);
        this.sendJson(response, 200, {
          polarbearLoop: this.polarbearLoopStatus(room),
        });
        return;
      }

      if (request.method === 'POST' && action === 'resume') {
        const polarbearAdmin = this.getPolarbearAdmin();
        await polarbearAdmin.resumePolarbearLoop(room);
        this.sendJson(response, 200, {
          polarbearLoop: this.polarbearLoopStatus(room),
        });
        return;
      }
    }

    const wallpanelRoomPanelAdminMatch = url.pathname.match(
      /^\/wallpanel-insights\/rooms\/([^/]+)\/([^/]+)\/panels\/([^/]+)\/(reboot|baudrate)$/,
    );
    if (wallpanelRoomPanelAdminMatch && request.method === 'POST') {
      const room = {
        zoneId: decodeURIComponent(wallpanelRoomPanelAdminMatch[1]),
        roomId: decodeURIComponent(wallpanelRoomPanelAdminMatch[2]),
      };
      const action = wallpanelRoomPanelAdminMatch[4];
      const polarbearAdmin = this.getPolarbearAdmin();

      this.assertPolarbearLoopPaused(polarbearAdmin, room);

      if (action === 'reboot') {
        const { unitIds } = await this.readPolarbearAdminRequest(
          request,
          url,
          room,
        );
        await polarbearAdmin.rebootPolarbears(unitIds, room);
        this.sendJson(response, 202, { ok: true, unitIds });
        return;
      }

      const { unitIds, baudrate } = await this.readPolarbearAdminRequest(
        request,
        url,
        room,
      );

      if (!baudrate || BAUDRATE_VALUES[baudrate] === undefined) {
        throw new Error(
          `Unsupported baudrate: ${baudrate}. Supported: ${Object.keys(BAUDRATE_VALUES).join(', ')}`,
        );
      }

      await polarbearAdmin.setPolarbearBaudrate(unitIds, baudrate, room);
      this.sendJson(response, 202, { ok: true, unitIds, baudrate });
      return;
    }

    if (
      request.method === 'GET' &&
      url.pathname === CONTROL_PATHS.wallpanelSyncStatus
    ) {
      this.sendJson(response, 200, {
        polarbearLoop: {
          ...(this.polarbearAdmin?.getPolarbearLoopStatus() ?? {
            paused: false,
          }),
          running: !(
            this.polarbearAdmin?.getPolarbearLoopStatus().paused ?? false
          ),
        },
      });
      return;
    }

    if (
      request.method === 'POST' &&
      url.pathname === CONTROL_PATHS.wallpanelSyncPause
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();
      await polarbearAdmin.pausePolarbearLoop();
      this.sendJson(response, 200, {
        polarbearLoop: {
          ...polarbearAdmin.getPolarbearLoopStatus(),
          running: false,
        },
      });
      return;
    }

    if (
      request.method === 'POST' &&
      url.pathname === CONTROL_PATHS.wallpanelSyncResume
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();
      await polarbearAdmin.resumePolarbearLoop();
      this.sendJson(response, 200, {
        polarbearLoop: {
          ...polarbearAdmin.getPolarbearLoopStatus(),
          running: true,
        },
      });
      return;
    }

    const wallpanelRebootMatch = url.pathname.match(
      /^\/wallpanel-insights\/panels\/([^/]+)\/reboot$/,
    );
    if (wallpanelRebootMatch && request.method === 'POST') {
      const polarbearAdmin = this.getPolarbearAdmin();
      this.assertPolarbearLoopPaused(polarbearAdmin);
      const { unitIds } = await this.readPolarbearAdminRequest(request, url);
      await polarbearAdmin.rebootPolarbears(unitIds);
      this.sendJson(response, 202, { ok: true, unitIds });
      return;
    }

    const wallpanelBaudrateMatch = url.pathname.match(
      /^\/wallpanel-insights\/panels\/([^/]+)\/baudrate$/,
    );
    if (wallpanelBaudrateMatch && request.method === 'POST') {
      const polarbearAdmin = this.getPolarbearAdmin();
      this.assertPolarbearLoopPaused(polarbearAdmin);
      const { unitIds, baudrate } = await this.readPolarbearAdminRequest(
        request,
        url,
      );

      if (!baudrate || BAUDRATE_VALUES[baudrate] === undefined) {
        throw new Error(
          `Unsupported baudrate: ${baudrate}. Supported: ${Object.keys(BAUDRATE_VALUES).join(', ')}`,
        );
      }

      await polarbearAdmin.setPolarbearBaudrate(unitIds, baudrate);
      this.sendJson(response, 202, { ok: true, unitIds, baudrate });
      return;
    }

    const aircoInsightsMatch = url.pathname.match(
      /^\/airco-insights\/rooms\/([^/]+)\/([^/]+)$/,
    );
    if (aircoInsightsMatch && request.method === 'GET') {
      this.sendJson(
        response,
        200,
        await this.aircoInsightsResponse(
          decodeURIComponent(aircoInsightsMatch[1]),
          decodeURIComponent(aircoInsightsMatch[2]),
        ),
      );
      return;
    }

    const aircoStreamMatch = url.pathname.match(
      /^\/airco-insights\/stream\/rooms\/([^/]+)\/([^/]+)$/,
    );
    if (aircoStreamMatch && request.method === 'GET') {
      await this.streamInsights(response, 'insights', () =>
        this.aircoInsightsResponse(
          decodeURIComponent(aircoStreamMatch[1]),
          decodeURIComponent(aircoStreamMatch[2]),
        ),
      );
      return;
    }

    const aircoCommandMatch = url.pathname.match(
      /^\/airco-insights\/rooms\/([^/]+)\/([^/]+)\/aircos\/([^/]+)\/commands$/,
    );
    if (aircoCommandMatch && request.method === 'POST') {
      await this.handleFrontendAircoCommand(
        request,
        decodeURIComponent(aircoCommandMatch[1]),
        decodeURIComponent(aircoCommandMatch[2]),
      );
      this.sendJson(response, 202, { ok: true });
      return;
    }

    if (
      (request.method === 'PATCH' || request.method === 'PUT') &&
      url.pathname === CONTROL_PATHS.settings
    ) {
      const patch = await this.readJsonRequest<SettingsPatch>(request);
      const settings = await this.configStore.updateSettings(patch);

      this.sendJson(response, 200, {
        ok: true,
        settings,
        restartRequired: true,
      });
      return;
    }

    if (
      request.method === 'POST' &&
      url.pathname === CONTROL_PATHS.polarbearReboot
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();

      this.assertPolarbearLoopPaused(polarbearAdmin);
      const { unitIds } = await this.readPolarbearAdminRequest(request, url);
      await polarbearAdmin.rebootPolarbears(unitIds);

      this.sendJson(response, 202, {
        ok: true,
        command: 'polarbearReboot',
        unitIds,
      });
      return;
    }

    if (
      request.method === 'POST' &&
      url.pathname === CONTROL_PATHS.polarbearBaudrate
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();

      this.assertPolarbearLoopPaused(polarbearAdmin);
      const { unitIds, baudrate } = await this.readPolarbearAdminRequest(
        request,
        url,
      );

      if (!baudrate) {
        throw new Error(
          `missing baudrate. Supported: ${Object.keys(BAUDRATE_VALUES).join(', ')}`,
        );
      }

      if (BAUDRATE_VALUES[baudrate] === undefined) {
        throw new Error(
          `Unsupported baudrate: ${baudrate}. Supported: ${Object.keys(
            BAUDRATE_VALUES,
          ).join(', ')}`,
        );
      }

      await polarbearAdmin.setPolarbearBaudrate(unitIds, baudrate);

      this.sendJson(response, 202, {
        ok: true,
        command: 'polarbearBaudrate',
        unitIds,
        baudrate,
      });
      return;
    }

    if (
      request.method === 'POST' &&
      url.pathname === CONTROL_PATHS.polarbearPause
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();

      await polarbearAdmin.pausePolarbearLoop();

      this.sendJson(response, 200, {
        ok: true,
        command: 'polarbearLoopPause',
        polarbearLoop: polarbearAdmin.getPolarbearLoopStatus(),
      });
      return;
    }

    if (
      request.method === 'POST' &&
      url.pathname === CONTROL_PATHS.polarbearResume
    ) {
      const polarbearAdmin = this.getPolarbearAdmin();

      await polarbearAdmin.resumePolarbearLoop();

      this.sendJson(response, 200, {
        ok: true,
        command: 'polarbearLoopResume',
        polarbearLoop: polarbearAdmin.getPolarbearLoopStatus(),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === CONTROL_PATHS.setpoint) {
      const value = await this.readNumberFromRequest(request, url);
      const temperature = round1(value);
      const topics = createTopics(this.settings);

      await this.publishCommand(topics.setTemperatureSet, temperature);
      this.rememberPolarbearCommand('setpoint', temperature);
      this.sendJson(response, 202, {
        ok: true,
        command: 'setpoint',
        value: temperature,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === CONTROL_PATHS.fanMode) {
      const value = normalizeFanMode(
        await this.readNumberFromRequest(request, url),
      );
      const topics = createTopics(this.settings);

      await this.publishCommand(topics.fanModeSet, value);
      this.rememberPolarbearCommand('fanMode', value);
      this.sendJson(response, 202, {
        ok: true,
        command: 'fanMode',
        value,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === CONTROL_PATHS.fanSpeed) {
      const value = Math.round(await this.readNumberFromRequest(request, url));
      const topics = createTopics(this.settings);

      await this.publishCommand(topics.fanSpeedSet, value);
      this.rememberPolarbearCommand('fanSpeed', value);
      this.sendJson(response, 202, {
        ok: true,
        command: 'fanSpeed',
        value,
      });
      return;
    }

    this.sendJson(response, 404, { ok: false, error: 'not found' });
  }

  private async wallpanelInsightsResponse(
    zoneId: string,
    roomId: string,
  ): Promise<unknown> {
    const settings = await this.getSettingsForRoomOrNull(zoneId, roomId);

    if (!settings) {
      return this.wallpanelInsightsFallbackResponse(zoneId, roomId);
    }

    const state = this.readableState(createTopics(settings));
    const snapshots = this.polarbearInsights({ zoneId, roomId });

    return {
      roomName: settings.roomName,
      generatedAt: new Date().toISOString(),
      panels: [
        {
          panelId: settings.wallpanel.id,
          name: settings.wallpanel.name,
          ip: settings.wallpanel.host,
          port: settings.wallpanel.port,
          type: settings.wallpanel.units[0]?.type,
          terminalIds: settings.wallpanel.units.map((unit) => unit.id),
          status: 'ok',
          error: null,
          units: settings.wallpanel.units.map((unit) => ({
            unitId: unit.id,
            zones: unit.zones.map((zone) => {
              const snapshot = snapshots.find(
                (candidate) =>
                  candidate.unitId === unit.id && candidate.zone === zone,
              );

              return {
                zone,
                status: 'ok',
                setpoint: snapshot?.setpoint ?? state.setpoint?.value,
                virtualTemperature:
                  snapshot?.virtualTemperature ?? state.virtualTemp?.value,
                fanSpeed: snapshot?.fanSpeed ?? state.fanSpeed?.value,
                fanMode: snapshot?.fanMode ?? state.fanMode?.value,
              };
            }),
          })),
        },
      ],
    };
  }

  private async aircoInsightsResponse(
    zoneId: string,
    roomId: string,
  ): Promise<unknown> {
    const settings = await this.getSettingsForRoomOrNull(zoneId, roomId);

    if (!settings) {
      return this.aircoInsightsFallbackResponse(zoneId, roomId);
    }

    const state = this.readableState(createTopics(settings));
    const snapshot = this.polarbearInsights({ zoneId, roomId }).find(
      (candidate) =>
        candidate.unitId === settings.airco.unitId &&
        candidate.zone === settings.airco.zone,
    );
    const snapshotUpdatedAt = snapshot?.updatedAt;

    return {
      zoneId: settings.climatezoneId,
      roomId: settings.roomId,
      roomName: settings.roomName,
      generatedAt: new Date().toISOString(),
      aircos: [
        {
          aircoId: settings.airco.airconditionerId,
          name: settings.airco.name,
          deviceType: settings.airco.model,
          adapterType: settings.airco.type,
          environmentDeviceId: settings.airco.deviceId,
          unitId: settings.airco.unitId,
          commands: ['setpoint', 'fanSpeed', 'fanMode'],
          zones: [
            {
              zone: settings.airco.zone,
              status: 'ok',
              setpoint: this.newestInsightValue(
                snapshot?.setpoint,
                snapshotUpdatedAt,
                state.setpoint,
              ),
              virtualTemperature: this.newestInsightValue(
                snapshot?.virtualTemperature,
                snapshotUpdatedAt,
                state.virtualTemp,
              ),
              fanSpeed: this.newestInsightValue(
                snapshot?.fanSpeed,
                snapshotUpdatedAt,
                state.fanSpeed,
              ),
              fanMode: this.newestInsightValue(
                snapshot?.fanMode,
                snapshotUpdatedAt,
                state.fanMode,
              ),
              updatedAt:
                this.newestInsightUpdatedAt(snapshotUpdatedAt, [
                  state.setpoint,
                  state.virtualTemp,
                  state.fanSpeed,
                  state.fanMode,
                ]) ??
                state.setpoint?.updatedAt ??
                state.virtualTemp?.updatedAt ??
                state.fanSpeed?.updatedAt ??
                state.fanMode?.updatedAt ??
                null,
              commands: ['setpoint', 'fanSpeed', 'fanMode'],
            },
          ],
        },
      ],
    };
  }

  private newestInsightValue(
    snapshotValue: number | undefined,
    snapshotUpdatedAt: string | undefined,
    mqttState: NumericState | null,
  ): number | undefined {
    if (snapshotValue === undefined) {
      return mqttState?.value;
    }

    if (!mqttState) {
      return snapshotValue;
    }

    if (!snapshotUpdatedAt) {
      return mqttState.value;
    }

    return Date.parse(mqttState.updatedAt) >= Date.parse(snapshotUpdatedAt)
      ? mqttState.value
      : snapshotValue;
  }

  private newestInsightUpdatedAt(
    snapshotUpdatedAt: string | undefined,
    mqttStates: Array<NumericState | null>,
  ): string | undefined {
    return [snapshotUpdatedAt, ...mqttStates.map((state) => state?.updatedAt)]
      .filter((value): value is string => typeof value === 'string')
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  }

  private async streamInsights(
    response: ServerResponse,
    eventName: string,
    buildPayload: () => Promise<unknown>,
  ): Promise<void> {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = async () => {
      try {
        response.write(`event: ${eventName}\n`);
        response.write(`data: ${JSON.stringify(await buildPayload())}\n\n`);
      } catch (error) {
        response.write('event: insights-error\n');
        response.write(
          `data: ${JSON.stringify({ message: formatError(error) })}\n\n`,
        );
      }
    };

    await send();
    const interval = setInterval(() => {
      void send();
    }, 2500);

    response.on('close', () => clearInterval(interval));
  }

  private async handleFrontendAircoCommand(
    request: IncomingMessage,
    zoneId: string,
    roomId: string,
  ): Promise<void> {
    const body = await this.readJsonRequest<{
      property?: string;
      value?: unknown;
      zone?: unknown;
    }>(request);
    const value = Number(body.value);
    const settings = await this.getSettingsForRoom(zoneId, roomId);
    const topics = createTopics(settings);

    if (!Number.isFinite(value)) {
      throw new Error('missing numeric value');
    }

    if (body.property === 'setpoint') {
      const temperature = round1(value);

      await this.publishCommand(topics.setTemperatureSet, temperature);
      this.rememberPolarbearCommand('setpoint', temperature, { zoneId, roomId });
      return;
    }

    if (body.property === 'fanMode') {
      const fanMode = normalizeFanMode(value);

      await this.publishCommand(topics.fanModeSet, fanMode);
      this.rememberPolarbearCommand('fanMode', fanMode, { zoneId, roomId });
      return;
    }

    if (body.property === 'fanSpeed') {
      const fanSpeed = Math.round(value);

      await this.publishCommand(topics.fanSpeedSet, fanSpeed);
      this.rememberPolarbearCommand('fanSpeed', fanSpeed, { zoneId, roomId });
      return;
    }

    throw new Error(`unsupported command property: ${body.property}`);
  }

  private readableState(
    topics: MqttTopics = TOPICS,
  ): Record<string, { value: number; updatedAt: string } | null> {
    return {
      setpoint: this.state[topics.setTemperatureState] ?? null,
      fanMode: this.state[topics.fanModeState] ?? null,
      fanSpeed: this.state[topics.fanSpeedState] ?? null,
      virtualTemp: this.state[topics.virtualTempState] ?? null,
    };
  }

  private rememberPolarbearCommand(
    property: 'setpoint' | 'fanMode' | 'fanSpeed',
    value: number,
    room?: SyncRoomRef,
  ): void {
    if (!this.polarbearAdmin) {
      return;
    }

    try {
      this.polarbearAdmin.rememberMqttCommand(property, value, room);
    } catch (error) {
      log(
        `polarbear command remember failed property=${property}: ${formatError(error)}`,
      );
    }
  }

  private polarbearLoopStatus(room?: SyncRoomRef): {
    paused: boolean;
    running: boolean;
    error?: string;
  } {
    try {
      const status = this.polarbearAdmin?.getPolarbearLoopStatus(room) ?? {
        paused: false,
      };

      return {
        ...status,
        running: !status.paused && !!this.polarbearAdmin,
      };
    } catch (error) {
      return {
        paused: false,
        running: false,
        error: formatError(error),
      };
    }
  }

  private polarbearInsights(room: SyncRoomRef): PolarbearInsightSnapshot[] {
    try {
      return this.polarbearAdmin?.getPolarbearInsights(room) ?? [];
    } catch {
      return [];
    }
  }

  private async wallpanelInsightsFallbackResponse(
    zoneId: string,
    roomId: string,
  ): Promise<unknown> {
    const room = await this.getFrontendRoom(zoneId, roomId);

    return {
      roomName: room?.name ?? '',
      generatedAt: new Date().toISOString(),
      panels: (room?.aircopanels ?? []).map((panel: any) => {
        const units = Array.isArray(panel.modbusUnits)
          ? panel.modbusUnits
          : (panel.ids ?? panel.terminalIds ?? []).map((id: unknown) => ({
              id,
              zones: [1],
            }));

        return {
          panelId: String(panel.id ?? ''),
          name: String(panel.name ?? 'Wallpanel'),
          ip: String(panel.ip ?? ''),
          port: Number(panel.port ?? 0),
          type: panel.type,
          terminalIds: units.map((unit: any) => Number(unit.id)),
          status: 'error',
          error:
            'No active sync config for this room. Add a wallpanel, airconditioner and linked system device.',
          units: units.map((unit: any) => ({
            unitId: Number(unit.id),
            zones: (Array.isArray(unit.zones) ? unit.zones : [1]).map(
              (zone: unknown) => ({
                zone: Number(zone) === 2 ? 2 : 1,
                status: 'error',
                error: 'Sync not active for this room',
              }),
            ),
          })),
        };
      }),
    };
  }

  private async aircoInsightsFallbackResponse(
    zoneId: string,
    roomId: string,
  ): Promise<unknown> {
    const room = await this.getFrontendRoom(zoneId, roomId);

    return {
      zoneId,
      roomId,
      roomName: room?.name ?? '',
      generatedAt: new Date().toISOString(),
      aircos: (room?.airconditioners ?? []).map((airco: any) => ({
        aircoId: String(airco.id ?? ''),
        name: String(airco.name ?? 'Airconditioning'),
        deviceType: String(airco.deviceType ?? ''),
        adapterType: String(airco.data?.type ?? ''),
        environmentDeviceId: String(airco.data?.deviceId ?? ''),
        unitId: Number(airco.data?.deviceTerminalId ?? 0) || null,
        commands: ['setpoint', 'fanSpeed', 'fanMode'],
        zones: [
          {
            zone: 1,
            status: 'error',
            error:
              'No active sync config for this room. Check the linked system device.',
            updatedAt: null,
            commands: ['setpoint', 'fanSpeed', 'fanMode'],
          },
        ],
      })),
    };
  }

  private async getFrontendRoom(zoneId: string, roomId: string): Promise<any> {
    const zones = (await this.configStore.getFrontendZones()) as any[];
    const zone = zones.find((candidate) => candidate.id === zoneId);

    return zone?.rooms?.find((candidate: any) => candidate.id === roomId);
  }

  private async getSettingsForRoomOrNull(
    zoneId: string,
    roomId: string,
  ): Promise<RuntimeSettings | null> {
    return (
      (await this.configStore.getAllSettings()).find(
        (candidate) =>
          candidate.climatezoneId === zoneId && candidate.roomId === roomId,
      ) ?? null
    );
  }

  private async getSettingsForRoom(
    zoneId: string,
    roomId: string,
  ): Promise<RuntimeSettings> {
    const settings = await this.getSettingsForRoomOrNull(zoneId, roomId);

    if (!settings) {
      throw new Error(`no sync config found for zone=${zoneId} room=${roomId}`);
    }

    return settings;
  }

  private getPolarbearAdmin(): PolarbearAdminController {
    if (!this.polarbearAdmin) {
      throw new Error('polarbear admin is not active in this runMode');
    }

    return this.polarbearAdmin;
  }

  private assertPolarbearLoopPaused(
    polarbearAdmin: PolarbearAdminController,
    room?: SyncRoomRef,
  ): void {
    if (!polarbearAdmin.getPolarbearLoopStatus(room).paused) {
      throw new Error(
        'pause the polarbear poll-loop first before rebooting or changing the baudrate ',
      );
    }
  }

  private async readPolarbearAdminRequest(
    request: IncomingMessage,
    url: URL,
    room?: SyncRoomRef,
  ): Promise<{ unitIds: number[]; baudrate?: number }> {
    const rawBody = await this.readBody(request);
    const body = rawBody.trim()
      ? (JSON.parse(rawBody) as Record<string, unknown>)
      : {};

    const settings = room
      ? await this.getSettingsForRoom(room.zoneId, room.roomId)
      : await this.configStore.getSettings();
    const configuredUnitIds = settings.wallpanel.units.map((unit) => unit.id);
    const unitIds = this.parseUnitIds(
      body.unitIds ??
        body.ids ??
        url.searchParams.get('unitIds') ??
        url.searchParams.get('ids'),
      configuredUnitIds,
    );
    const unknownUnitIds = unitIds.filter(
      (unitId) => !configuredUnitIds.includes(unitId),
    );

    if (unknownUnitIds.length > 0) {
      throw new Error(
        `unknown polarbear unit-id(s): ${unknownUnitIds.join(', ')}`,
      );
    }

    return {
      unitIds,
      baudrate: this.parseOptionalNumber(
        body.baudrate ??
          body.baudRate ??
          body.value ??
          url.searchParams.get('baudrate') ??
          url.searchParams.get('baudRate') ??
          url.searchParams.get('value'),
      ),
    };
  }

  private parseUnitIds(value: unknown, fallback: number[]): number[] {
    const rawValues =
      value === undefined || value === null || value === ''
        ? fallback
        : Array.isArray(value)
          ? value
          : String(value).split(',');

    const unitIds = rawValues
      .map((unitId) => Number(unitId))
      .filter((unitId) => Number.isFinite(unitId) && unitId > 0)
      .map((unitId) => Math.round(unitId));
    const uniqueUnitIds = Array.from(new Set(unitIds));

    if (uniqueUnitIds.length === 0) {
      throw new Error('No valid polarbear units-id has been giving');
    }

    return uniqueUnitIds;
  }

  private parseOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  private async readNumberFromRequest(
    request: IncomingMessage,
    url: URL,
  ): Promise<number> {
    const queryValue =
      url.searchParams.get('value') ??
      url.searchParams.get('temperature') ??
      url.searchParams.get('setpoint');

    if (queryValue !== null) {
      const parsed = Number(queryValue);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const rawBody = await this.readBody(request);
    const text = rawBody.trim();

    if (!text) {
      throw new Error('missing numeric value');
    }

    const directNumber = Number(text);

    if (Number.isFinite(directNumber)) {
      return directNumber;
    }

    let json: unknown;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('body must be JSON or a number');
    }

    const value = parseCommandNumber(json);

    if (value === null) {
      throw new Error('missing numeric value');
    }

    return value;
  }

  private async readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;

      if (total > CONFIG.control.requestBodyLimitBytes) {
        throw new Error('request body too large');
      }

      chunks.push(buffer);
    }

    return Buffer.concat(chunks).toString('utf8');
  }

  private async readJsonRequest<T>(request: IncomingMessage): Promise<T> {
    const rawBody = await this.readBody(request);

    if (!rawBody.trim()) {
      throw new Error('missing JSON body');
    }

    return JSON.parse(rawBody) as T;
  }

  private async publishCommand(topic: string, value: number): Promise<void> {
    if (!this.client || !this.mqttConnected) {
      throw new Error('mqtt is not connected');
    }

    await new Promise<void>((resolve, reject) => {
      this.client?.publish(
        topic,
        String(value),
        { retain: CONFIG.mqtt.retainCommands },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          log(`control mqtt command ${topic}=${value}`);
          resolve();
        },
      );
    });
  }

  private sendJson(
    response: ServerResponse,
    statusCode: number,
    payload: unknown,
  ): void {
    if (response.headersSent) {
      return;
    }

    response.writeHead(statusCode, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(payload, null, 2));
  }
}
