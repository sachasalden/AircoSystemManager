import path from 'path';
import dotenv from 'dotenv';
import AircoDeviceController from './controllers/AircoDeviceController.ts';
import { EnvironmentDeviceRepository } from './repositories/EnvironmentDeviceRepository.ts';
import { EnvironmentDeviceController } from './controllers/EnvironmentDeviceController.ts';
import { EnvironmentDeviceService } from './services/EnvironmentDeviceService.ts';

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

console.log('[main] cwd =', process.cwd());
console.log('[main] TEST_ZONE_ID =', process.env.TEST_ZONE_ID);
console.log('[main] TEST_ROOM_ID =', process.env.TEST_ROOM_ID);

import express from 'express';
import cors from 'cors';

import AdapterRegistry from './adapters/AdapterRegistry';
import { registerDefaultAdapters } from './adapters/registerAdapters';
import PolarbearController from './controllers/PolarbearController';
import DeviceService from './services/DeviceService';
import SyncMainLoop from './services/SyncMainLoop';
import { AircopanelRepository } from './repositories/WallpanelRepository';
import createWallpanelInsightsRoute from './routes/WallpanelInsightsRoute';
import createDevicesRoute from './routes/DevicesRoute';
import createAircoDevicesRoute from './routes/AircoDevicesRoute';
import createEnvironmentDevicesRoute from './routes/EnvironmentDevicesRoute';
import WallpanelInsightsStore from './services/WallpanelInsightsStore';

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://192.168.55.10:27017';
const mqttBrokerUrl = process.env.MQTT_BROKER || 'mqtt://192.168.55.10';
const mqttTopicPrefix = process.env.MQTT_TOPIC_PREFIX || 'airco/sync';
const sourceInstanceId =
  process.env.SYNC_INSTANCE_ID ||
  `${process.env.HOSTNAME || 'node'}-${process.pid}`;

const wallpanelInsightsStore = new WallpanelInsightsStore();

const repository = new AircopanelRepository(mongoUri);
const controller = new PolarbearController(
  2000,
  repository,
  wallpanelInsightsStore,
);
const deviceService = new DeviceService(repository);
const aircoDeviceController = new AircoDeviceController(repository);

const environmentDeviceRepository = new EnvironmentDeviceRepository(mongoUri);
const environmentDeviceService = new EnvironmentDeviceService(
  environmentDeviceRepository,
);
const environmentDeviceController = new EnvironmentDeviceController(
  environmentDeviceService,
);

const registry = new AdapterRegistry();
registerDefaultAdapters(registry);

const syncMainLoop = new SyncMainLoop(
  repository,
  registry,
  mqttBrokerUrl,
  mqttTopicPrefix,
  sourceInstanceId,
  wallpanelInsightsStore,
);

app.use(
  '/wallpanel-insights',
  createWallpanelInsightsRoute(controller, wallpanelInsightsStore),
);
app.use('/devices', createDevicesRoute(controller, deviceService));
app.use('/airco-devices', createAircoDevicesRoute(aircoDeviceController));
app.use(
  '/environment-devices',
  createEnvironmentDevicesRoute(environmentDeviceController),
);

async function start(): Promise<void> {
  await syncMainLoop.start();

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`API server running on port ${port}`);
  });
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[main] received ${signal}, shutting down`);

  try {
    await syncMainLoop.stop();
  } catch (error) {
    console.error('[main] stop failed', error);
  }

  process.exit(0);
}

void start().catch((error) => {
  console.error('[main] startup failed', error);
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
