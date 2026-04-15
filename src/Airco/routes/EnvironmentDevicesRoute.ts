import { Router } from 'express';
import { EnvironmentDeviceController } from '../controllers/EnvironmentDeviceController.ts';

export default function createEnvironmentDevicesRoute(
  environmentDeviceController: EnvironmentDeviceController,
) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const result = await environmentDeviceController.getDevices();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const device = await environmentDeviceController.addDevice(req.body);
      res.json(device);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
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

  router.put('/:id', async (req, res) => {
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

  router.delete('/:id', async (req, res) => {
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

  return router;
}
