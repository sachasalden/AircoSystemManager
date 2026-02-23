import express from 'express';
import PolarbearController from './controllers/PolarbearController';
import cors from 'cors';
import MonitorPolarbearService from './services/MonitorPolarbearService.ts';
import { AircopanelRepository } from './repositories/WallpanelRepository.ts';



const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://192.168.55.10:27017';
const controller = new PolarbearController(2000, mongoUri);
const monitorService = new MonitorPolarbearService(controller['repository'], 5000, 10000);

monitorService.start();

app.get('/devices', async (req, res) => {
  try {
    const db = controller['repository']['client'].db(
      controller['repository']['dbName'],
    );
    const collection = db.collection(
      controller['repository']['collectionName'],
    );
    const zones = await collection.find({}).toArray();

    const result = zones.map((zone: any) => ({
      id: zone._id.toString(),
      name: zone.name,
      rooms: (zone.rooms || []).map((room: any) => ({
        id: room.id,
        name: room.name,
        aircopanels: room.aircopanels || [],
      })),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/devices', async (req, res) => {
  console.log('POST /devices body:', req.body);
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
    if (!device) return res.status(404).json({ error: 'Device not found' });
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
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/devices/:id', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const updatedDevice = req.body;
    updatedDevice.id = deviceId; // Ensure the id is set
    const result = await controller.updateDevice(updatedDevice);
    if (!result) return res.status(404).json({ error: 'Device not found' });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});




const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
