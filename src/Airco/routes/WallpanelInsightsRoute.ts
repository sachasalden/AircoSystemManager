import { Router } from 'express';
import PolarbearController from '../controllers/PolarbearController';
import WallpanelInsightsStore from '../services/WallpanelInsightsStore';

export default function createWallpanelInsightsRoute(
  controller: PolarbearController,
  insightsStore: WallpanelInsightsStore,
) {
  const router = Router();

  router.get('/rooms/:zoneId/:roomId', async (req, res) => {
    try {
      const { zoneId, roomId } = req.params;

      const data = await controller.getRoomWallpanelInsights(zoneId, roomId);

      res.json(data);
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get wallpanel insights',
      });
    }
  });

  router.get('/stream/rooms/:zoneId/:roomId', async (req, res) => {
    const { zoneId, roomId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = async () => {
      try {
        const data = await controller.getRoomWallpanelInsights(zoneId, roomId);
        res.write(`event: insights\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        res.write(`event: insights-error\n`);
        res.write(
          `data: ${JSON.stringify({
            message:
              error instanceof Error
                ? error.message
                : 'Failed to get wallpanel insights',
          })}\n\n`,
        );
      }
    };

    await send();

    const unsubscribe = insightsStore.subscribe((message) => {
      if (message.zoneId !== zoneId || message.roomId !== roomId) {
        return;
      }

      void send();
    });

    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  return router;
}
