import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import AdapterRegistry from './adapters/AdapterRegistry';
import { registerDefaultAdapters } from './adapters/registerAdapters';
import PolarbearController from './controllers/PolarbearController';
import MonitorAircoService from './services/MonitorAircoService';
import MonitorPolarbearService from './services/MonitorPolarbearService';
import DeviceService from './services/DeviceService';
import MqttBridgeService from './services/MqttBridgeService';
import SyncEchoGuard from './services/SyncEchoGuard';
import { AircopanelRepository } from './repositories/WallpanelRepository';

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://192.168.55.10:27017';
const mqttBrokerUrl = process.env.MQTT_BROKER || 'mqtt://192.168.55.10';
const mqttTopicPrefix = process.env.MQTT_TOPIC_PREFIX || 'airco/sync';

const repository = new AircopanelRepository(mongoUri);
const controller = new PolarbearController(2000, repository);
const deviceService = new DeviceService(repository);
const registry = new AdapterRegistry();
registerDefaultAdapters(registry);

const echoGuard = new SyncEchoGuard();
const mqttBridge = new MqttBridgeService(mqttBrokerUrl, mqttTopicPrefix);
const monitorService = new MonitorPolarbearService(
  repository,
  (message) => mqttBridge.publishPanelChange(message),
  echoGuard,
  1000,
  10000,
  20,
);
const aircoMonitorService = new MonitorAircoService(
  repository,
  registry,
  (message) => mqttBridge.publishAircoChange(message),
  echoGuard,
  1000,
);

async function startSyncServices() {
  await mqttBridge.start({
    onPanelMessage: async (message) => {
      await aircoMonitorService.applyRemoteChange(message);
    },
    onAircoMessage: async (message) => {
      await monitorService.applyRemoteChange(message);
    },
  });

  monitorService.start();
  aircoMonitorService.start();
}

void startSyncServices().catch((error) => {
  console.error('[main] failed to start sync services', error);
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
