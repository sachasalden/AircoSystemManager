import { Router } from 'express';
import PolarbearController from '../controllers/PolarbearController';
import WallpanelInsightsStore from '../services/WallpanelInsightsStore';
import SyncMainLoop from '../services/SyncMainLoop';

const SUPPORTED_BAUDRATES = [9600, 19200, 57600, 115200] as const;

export default function createWallpanelInsightsRoute(
  controller: PolarbearController,
  insightsStore: WallpanelInsightsStore,
  syncMainLoop: SyncMainLoop,
) {
  const router = Router();

  router.get('/sync/status', (_req, res) => {
    res.json({
      ok: true,
      polarbearLoop: syncMainLoop.getPolarbearLoopStatus(),
    });
  });

  router.post('/sync/pause', async (_req, res) => {
    try {
      await syncMainLoop.pausePolarbearLoop();
      res.json({
        ok: true,
        polarbearLoop: syncMainLoop.getPolarbearLoopStatus(),
      });
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to pause polarbear sync',
      });
    }
  });

  router.post('/sync/resume', async (_req, res) => {
    try {
      await syncMainLoop.resumePolarbearLoop();
      res.json({
        ok: true,
        polarbearLoop: syncMainLoop.getPolarbearLoopStatus(),
      });
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to resume polarbear sync',
      });
    }
  });

  router.post('/panels/:panelId/reboot', async (req, res) => {
    try {
      assertPolarbearLoopPaused(syncMainLoop);

      const unitIds = normalizeUnitIds(req.body?.unitIds);
      const rebootedUnitIds = await controller.rebootPolarbears(
        req.params.panelId,
        unitIds,
      );

      res.status(202).json({
        ok: true,
        command: 'reboot',
        panelId: req.params.panelId,
        unitIds: rebootedUnitIds,
      });
    } catch (error) {
      const status = isSyncActiveError(error) ? 409 : 500;

      res.status(status).json({
        message:
          error instanceof Error ? error.message : 'Failed to reboot polarbears',
      });
    }
  });

  router.post('/panels/:panelId/baudrate', async (req, res) => {
    try {
      assertPolarbearLoopPaused(syncMainLoop);

      const baudrate = Number(req.body?.baudrate);

      if (!SUPPORTED_BAUDRATES.includes(baudrate as any)) {
        return res.status(400).json({
          message: `Baudrate must be one of: ${SUPPORTED_BAUDRATES.join(', ')}`,
        });
      }

      const unitIds = normalizeUnitIds(req.body?.unitIds);
      const updatedUnitIds = await controller.setPolarbearBaudrate(
        req.params.panelId,
        baudrate,
        unitIds,
      );

      res.status(202).json({
        ok: true,
        command: 'baudrate',
        panelId: req.params.panelId,
        unitIds: updatedUnitIds,
        baudrate,
      });
    } catch (error) {
      const status = isSyncActiveError(error) ? 409 : 500;

      res.status(status).json({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to set polarbear baudrate',
      });
    }
  });

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

function assertPolarbearLoopPaused(syncMainLoop: SyncMainLoop): void {
  if (!syncMainLoop.getPolarbearLoopStatus().paused) {
    throw new Error(
      'Zet eerst de Polarbear sync op pauze voordat je reboot of baudrate wijzigt',
    );
  }
}

function isSyncActiveError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Polarbear sync op pauze')
  );
}

function normalizeUnitIds(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return [...new Set(value.map(Number))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}
