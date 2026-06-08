import { CONFIG } from './config/runtime.config';
import { ControlController } from './modules/control/control.controller';
import { ConfigService } from './modules/config/config.service';
import { AircoMqttBridgeService } from './modules/airco/airco-mqtt-bridge.service';
import { createDefaultAircoAdapterRegistry } from './modules/airco/register-airco-adapters';
import { WallpanelPollerService } from './modules/polarbear/wallpanel-poller.service';
import type {
  PolarbearInsightSnapshot,
  PolarbearAdminController,
  SyncRoomRef,
} from './types/shared.types';
import { formatError, log } from './utils/helpers';

let configStore: ConfigService | null = null;
let wallpanelPollers: WallpanelPollerService[] = [];
let aircoBridges: AircoMqttBridgeService[] = [];
let controlServer: ControlController | null = null;

class MultiRoomPolarbearAdmin implements PolarbearAdminController {
  constructor(private pollers: WallpanelPollerService[]) {}

  getPolarbearLoopStatus(room?: SyncRoomRef): { paused: boolean } {
    const pollers = this.getTargetPollers(room);

    return {
      paused:
        pollers.length > 0 &&
        pollers.every((poller) => poller.getPolarbearLoopStatus().paused),
    };
  }

  getPolarbearInsights(room?: SyncRoomRef): PolarbearInsightSnapshot[] {
    return this.getTargetPollers(room).flatMap((poller) =>
      poller.getPolarbearInsights(),
    );
  }

  rememberMqttCommand(
    property: 'setpoint' | 'fanMode' | 'fanSpeed',
    value: number,
    room?: SyncRoomRef,
  ): void {
    for (const poller of this.getTargetPollers(room)) {
      poller.rememberMqttCommand(property, value);
    }
  }

  async pausePolarbearLoop(room?: SyncRoomRef): Promise<void> {
    await Promise.all(
      this.getTargetPollers(room).map((poller) => poller.pausePolarbearLoop()),
    );
  }

  async resumePolarbearLoop(room?: SyncRoomRef): Promise<void> {
    await Promise.all(
      this.getTargetPollers(room).map((poller) => poller.resumePolarbearLoop()),
    );
  }

  async rebootPolarbears(unitIds: number[], room?: SyncRoomRef): Promise<void> {
    await Promise.all(
      this.getTargetPollers(room).map((poller) =>
        poller.rebootPolarbears(unitIds),
      ),
    );
  }

  async setPolarbearBaudrate(
    unitIds: number[],
    baudrate: number,
    room?: SyncRoomRef,
  ): Promise<void> {
    await Promise.all(
      this.getTargetPollers(room).map((poller) =>
        poller.setPolarbearBaudrate(unitIds, baudrate),
      ),
    );
  }

  private getTargetPollers(room?: SyncRoomRef): WallpanelPollerService[] {
    if (!room) {
      return this.pollers;
    }

    const pollers = this.pollers.filter((poller) =>
      poller.matchesRoom(room.zoneId, room.roomId),
    );

    if (pollers.length === 0) {
      throw new Error(
        `no active polarbear sync for zone=${room.zoneId} room=${room.roomId}`,
      );
    }

    return pollers;
  }
}

export const start = async (): Promise<void> => {
  const tasks: Promise<void>[] = [];

  configStore = new ConfigService();
  await configStore.connect();
  const settingsList = await configStore.getAllSettings();
  const aircoAdapterRegistry = createDefaultAircoAdapterRegistry();

  log(`loaded ${settingsList.length} room sync config(s) from mongodb`);

  wallpanelPollers =
    CONFIG.runMode === 'both' || CONFIG.runMode === 'polarbearPublisher'
      ? settingsList.map((settings) => new WallpanelPollerService(settings))
      : [];

  aircoBridges =
    CONFIG.runMode === 'both' || CONFIG.runMode === 'aircoBridge'
      ? settingsList.map(
          (settings) =>
            new AircoMqttBridgeService(settings, aircoAdapterRegistry),
        )
      : [];

  controlServer = CONFIG.control.enabled
    ? new ControlController(
        configStore,
        aircoAdapterRegistry,
        settingsList[0],
        wallpanelPollers.length > 0
          ? new MultiRoomPolarbearAdmin(wallpanelPollers)
          : undefined,
      )
    : null;

  if (controlServer) {
    await controlServer.start();
  }

  for (const aircoBridge of aircoBridges) {
    await aircoBridge.start();
  }

  for (const wallpanelPoller of wallpanelPollers) {
    tasks.push(wallpanelPoller.start());
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
};

export const stop = async (): Promise<void> => {
  log('shutdown gestart');

  for (const wallpanelPoller of wallpanelPollers) {
    await wallpanelPoller.stop();
  }

  for (const aircoBridge of aircoBridges) {
    await aircoBridge.stop();
  }

  if (controlServer) {
    await controlServer.stop();
  }

  if (configStore) {
    await configStore.close();
  }

  wallpanelPollers = [];
  aircoBridges = [];
};

export async function startWithShutdownHandlers(): Promise<void> {
  process.once('SIGINT', async () => {
    await stop();
    process.exit(0);
  });

  process.once('SIGTERM', async () => {
    await stop();
    process.exit(0);
  });

  await start();
}

export async function startOrExit(): Promise<void> {
  try {
    await startWithShutdownHandlers();
  } catch (error) {
    log(`fatal: ${formatError(error)}`);
    await stop();
    process.exit(1);
  }
}
