import { Router } from 'express';
import PolarbearController from '../controllers/PolarbearController';
import DeviceService from '../services/DeviceService';

export default function createDevicesRoute(
  controller: PolarbearController,
  deviceService: DeviceService,
) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const result = await deviceService.getDeviceTree();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const device = await controller.addDevice(req.body);
      res.json(device);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
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

  router.get('/:id', async (req, res) => {
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

  router.put('/:id', async (req, res) => {
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

  return router;
}
