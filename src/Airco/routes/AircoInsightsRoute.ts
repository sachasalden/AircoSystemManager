import { Router } from 'express';
import {
  AircopanelRepository,
  AirconditionerDevice,
} from '../repositories/WallpanelRepository';
import AircoInsightsStore from '../services/AircoInsightsStore';
import SyncMainLoop from '../services/SyncMainLoop';
import type { SyncProperty, Zone } from '../services/SyncTypes';

type AircoCommandProperty = Extract<
  SyncProperty,
  'setpoint' | 'fanSpeed' | 'fanMode'
>;

const COMMAND_PROPERTIES: readonly AircoCommandProperty[] = [
  'setpoint',
  'fanSpeed',
  'fanMode',
];

export default function createAircoInsightsRoute(
  repository: AircopanelRepository,
  insightsStore: AircoInsightsStore,
  syncMainLoop: SyncMainLoop,
) {
  const router = Router();

  async function getRoomAircoInsights(zoneId: string, roomId: string) {
    const zones = await repository.getZones();
    const zone = zones.find(
      (entry: any) => String(entry._id ?? '') === String(zoneId),
    );

    if (!zone) {
      throw new Error('Zone not found');
    }

    const room = zone.rooms?.find(
      (entry: any) => String(entry.id) === String(roomId),
    );

    if (!room) {
      throw new Error('Room not found');
    }

    const aircos = Array.isArray(room.airconditioners)
      ? room.airconditioners
      : [];

    return {
      zoneId,
      roomId,
      roomName: room.name ?? '',
      generatedAt: new Date().toISOString(),
      aircos: aircos.map((airco) => toAircoInsight(airco)),
    };
  }

  function toAircoInsight(airco: AirconditionerDevice) {
    const unitId = Number(airco.data?.deviceTerminalId);
    const unitState = Number.isFinite(unitId)
      ? insightsStore.getAircoState(airco.id)?.units.get(unitId)
      : undefined;

    return {
      aircoId: airco.id,
      name: airco.name ?? 'Airconditioning',
      deviceType: airco.deviceType,
      adapterType: airco.data?.type ?? 'unknown',
      environmentDeviceId: airco.data?.deviceId ?? '',
      unitId: Number.isFinite(unitId) ? unitId : null,
      commands: COMMAND_PROPERTIES,
      zones: ([1, 2] as const).map((zone) => {
        const zoneState = unitState?.zones.get(zone);

        if (!zoneState) {
          return {
            zone,
            status: 'error' as const,
            error: 'No cached airco data yet',
            commands: COMMAND_PROPERTIES,
          };
        }

        return {
          zone,
          status: 'ok' as const,
          setpoint: zoneState.setpoint,
          virtualTemperature: zoneState.virtualTemperature,
          fanSpeed: zoneState.fanSpeed,
          fanMode: zoneState.fanMode,
          updatedAt: zoneState.updatedAt,
          commands: COMMAND_PROPERTIES,
        };
      }),
    };
  }

  router.get('/rooms/:zoneId/:roomId', async (req, res) => {
    try {
      const { zoneId, roomId } = req.params;
      const data = await getRoomAircoInsights(zoneId, roomId);

      res.json(data);
    } catch (error) {
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get airco insights',
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
        const data = await getRoomAircoInsights(zoneId, roomId);
        res.write('event: insights\n');
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        res.write('event: insights-error\n');
        res.write(
          `data: ${JSON.stringify({
            message:
              error instanceof Error
                ? error.message
                : 'Failed to get airco insights',
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
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  router.post(
    '/rooms/:zoneId/:roomId/aircos/:aircoId/commands',
    async (req, res) => {
      try {
        const { zoneId, roomId, aircoId } = req.params;
        const property = String(
          req.body?.property ?? '',
        ) as AircoCommandProperty;
        const zone = Number(req.body?.zone) as Zone;
        const value = Number(req.body?.value);

        if (!COMMAND_PROPERTIES.includes(property)) {
          return res.status(400).json({
            message: 'Property must be one of: setpoint, fanSpeed, fanMode',
          });
        }

        if (zone !== 1 && zone !== 2) {
          return res.status(400).json({
            message: 'Zone must be 1 or 2',
          });
        }

        if (!Number.isFinite(value)) {
          return res.status(400).json({
            message: 'Value must be a number',
          });
        }

        const result = await syncMainLoop.applyAircoCommand({
          zoneId,
          roomId,
          aircoId,
          zone,
          property,
          value,
        });

        res.json({
          ok: true,
          zoneId,
          roomId,
          aircoId,
          unitId: result.unitId,
          zone,
          property,
          value,
        });
      } catch (error) {
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to apply airco command',
        });
      }
    },
  );

  return router;
}
