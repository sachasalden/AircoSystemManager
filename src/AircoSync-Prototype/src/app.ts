import { CONFIG } from "./config/runtime.config";
import { ControlController } from "./modules/control/control.controller";
import { ConfigService } from "./modules/config/config.service";
import { AircoMqttBridgeService } from "./modules/airco/airco-mqtt-bridge.service";
import { WallpanelPollerService } from "./modules/polarbear/wallpanel-poller.service";
import { formatError, log } from "./utils/helpers";

let configStore: ConfigService | null = null;
let wallpanelPoller: WallpanelPollerService | null = null;
let aircoBridge: AircoMqttBridgeService | null = null;
let controlServer: ControlController | null = null;

export const start = async (): Promise<void> => {
  const tasks: Promise<void>[] = [];

  configStore = new ConfigService();
  await configStore.connect();
  await configStore.loadAndApply();

  wallpanelPoller =
    CONFIG.runMode === "both" || CONFIG.runMode === "polarbearPublisher"
      ? new WallpanelPollerService()
      : null;

  aircoBridge =
    CONFIG.runMode === "both" || CONFIG.runMode === "aircoBridge"
      ? new AircoMqttBridgeService()
      : null;

  controlServer = CONFIG.control.enabled
    ? new ControlController(configStore, wallpanelPoller ?? undefined)
    : null;

  if (controlServer) {
    await controlServer.start();
  }

  if (aircoBridge) {
    await aircoBridge.start();
  }

  if (wallpanelPoller) {
    tasks.push(wallpanelPoller.start());
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
};

export const stop = async (): Promise<void> => {
  log("shutdown gestart");

  if (wallpanelPoller) {
    await wallpanelPoller.stop();
  }

  if (aircoBridge) {
    await aircoBridge.stop();
  }

  if (controlServer) {
    await controlServer.stop();
  }

  if (configStore) {
    await configStore.close();
  }
};

export async function startWithShutdownHandlers(): Promise<void> {
  process.once("SIGINT", async () => {
    await stop();
    process.exit(0);
  });

  process.once("SIGTERM", async () => {
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
