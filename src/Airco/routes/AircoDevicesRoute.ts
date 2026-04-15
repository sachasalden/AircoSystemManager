import { Router } from 'express';
import AircoDeviceController from '../controllers/AircoDeviceController.ts';

export default function createAircoDevicesRoute(
  aircoDeviceController: AircoDeviceController,
) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const result = await aircoDeviceController.getDevices();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const device = await aircoDeviceController.addDevice(req.body);
      res.json(device);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
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

  router.put('/:id', async (req, res) => {
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

  router.delete('/:id', async (req, res) => {
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
  });

  return router;
}
