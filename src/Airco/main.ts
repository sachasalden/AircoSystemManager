import path from 'path';
import dotenv from 'dotenv';
import AircoDeviceController from './controllers/AircoDeviceController.ts';
import { EnvironmentDeviceRepository} from './repositories/EnvironmentDeviceRepository.ts';
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

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://192.168.55.10:27017';
const mqttBrokerUrl = process.env.MQTT_BROKER || 'mqtt://192.168.55.10';
const mqttTopicPrefix = process.env.MQTT_TOPIC_PREFIX || 'airco/sync';
const sourceInstanceId =
  process.env.SYNC_INSTANCE_ID ||
  `${process.env.HOSTNAME || 'node'}-${process.pid}`;

const repository = new AircopanelRepository(mongoUri);
const controller = new PolarbearController(2000, repository);
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

app.get('/devices', async (_req, res) => {
  try {
    const result = await deviceService.getDeviceTree();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/devices', async (req, res) => {
  try {
    const device = await controller.addDevice(req.body);
    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/devices/:id', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const device = await controller.getDeviceById(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await controller.deleteDevice(deviceId);
    res.json({ id: deviceId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/devices/:id', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const device = await controller.getDeviceById(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/devices/:id', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const updatedDevice = {
      ...req.body,
      id: deviceId,
    };

    const result = await controller.updateDevice(updatedDevice);

    if (!result) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/airco-devices', async (_req, res) => {
  try {
    const result = await aircoDeviceController.getDevices();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/airco-devices', async (req, res) => {
  try {
    const device = await aircoDeviceController.addDevice(req.body);
    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/airco-devices/:id', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const device = await aircoDeviceController.getDeviceById(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Airco device not found' });
    }

    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/airco-devices/:id', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const updatedDevice = {
      ...req.body,
      id: deviceId,
    };

    const result = await aircoDeviceController.updateDevice(updatedDevice);

    if (!result) {
      return res.status(404).json({ error: 'Airco device not found' });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/airco-devices/:id', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const device = await aircoDeviceController.getDeviceById(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Airco device not found' });
    }

    await aircoDeviceController.deleteDevice(deviceId);
    res.json({ id: deviceId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }

})

app.get('/environment-devices', async (_req, res) => {
  try {
    const result = await environmentDeviceController.getDevices();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/environment-devices', async (req, res) => {
  try {
    const device = await environmentDeviceController.addDevice(req.body);
    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/environment-devices/:id', async (req, res) => {
  try {
    const device = await environmentDeviceController.getDeviceById(
      req.params.id,
    );

    if (!device) {
      return res.status(404).json({ error: 'Environment device not found' });
    }

    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/environment-devices/:id', async (req, res) => {
  try {
    const result = await environmentDeviceController.updateDevice(
      req.params.id,
      req.body,
    );

    if (!result) {
      return res.status(404).json({ error: 'Environment device not found' });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/environment-devices/:id', async (req, res) => {
  try {
    const result = await environmentDeviceController.deleteDevice(
      req.params.id,
    );

    if (!result) {
      return res.status(404).json({ error: 'Environment device not found' });
    }

    res.json({ id: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
