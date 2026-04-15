import AdapterRegistry from '../adapters/AdapterRegistry';
import { AircopanelRepository } from '../repositories/WallpanelRepository';
import TopologyService from './TopologyService';
import MqttSyncBus from './MqttSyncBus';
import SyncEchoGuard from './SyncEchoGuard';
import PolarbearMonitor from './PolarbearMonitor';
import AircoMonitor from './AircoMonitor';
import WallpanelInsightsStore from './WallpanelInsightsStore';
import {
  createMessageId,
  type PanelStateMessage,
  type SyncMessage,
  type TopologyRoom,
} from './SyncTypes';

export default class SyncMainLoop {
  private readonly topologyService: TopologyService;
  private readonly mqtt: MqttSyncBus;
  private readonly echoGuard: SyncEchoGuard;
  private readonly panelMonitor: PolarbearMonitor;
  private readonly aircoMonitor: AircoMonitor;

  private rooms: TopologyRoom[] = [];
  private panelTimer: NodeJS.Timeout | null = null;
  private aircoTimer: NodeJS.Timeout | null = null;
  private topologyTimer: NodeJS.Timeout | null = null;
  private isStopped = false;

  constructor(
    repository: AircopanelRepository,
    registry: AdapterRegistry,
    brokerUrl: string,
    topicPrefix: string,
    private sourceInstanceId: string,
    private insightsStore: WallpanelInsightsStore,
    private panelLoopMs = Number(process.env.PANEL_POLL_INTERVAL_MS || 2000),
    private aircoLoopMs = Number(process.env.AIRCO_POLL_INTERVAL_MS || 2000),
    private topologyRefreshMs = Number(
      process.env.TOPOLOGY_REFRESH_MS || 10000,
    ),
  ) {
    this.topologyService = new TopologyService(repository);
    this.mqtt = new MqttSyncBus(brokerUrl, sourceInstanceId, topicPrefix);
    this.echoGuard = new SyncEchoGuard(15000);

    this.aircoMonitor = new AircoMonitor(
      registry,
      this.echoGuard,
      async (message) => {
        const fullMessage = this.buildMessage(message);

        console.log(
          '[SyncMainLoop] local airco change -> apply to panel + mqtt',
          fullMessage,
        );

        await this.panelMonitor.applyAircoChangeLocally(
          this.rooms,
          fullMessage,
        );
        await this.mqtt.publish(fullMessage);
      },
    );

    this.panelMonitor = new PolarbearMonitor(
      this.echoGuard,
      async (message) => {
        const fullMessage = this.buildMessage(message);

        console.log(
          '[SyncMainLoop] local panel change -> apply to airco + mqtt',
          fullMessage,
        );

        await this.aircoMonitor.applyPanelChangeLocally(
          this.rooms,
          fullMessage,
        );
        await this.mqtt.publish(fullMessage);
      },
      async (context, snapshot) => {
        const panelStateMessage: PanelStateMessage = {
          schema: 'aircotest.panel-state.v1',
          sourceInstanceId: this.sourceInstanceId,
          timestamp: new Date().toISOString(),
          zoneId: context.zoneId,
          roomId: context.roomId,
          panelId: context.panelId,
          unitId: context.unitId,
          zone: context.zone,
          setpoint: snapshot.setpoint,
          virtualTemperature: snapshot.virtualTemperature,
          fanSpeed: snapshot.fanSpeed,
          fanMode: snapshot.fanMode,
        };

        await this.mqtt.publishPanelState(panelStateMessage);
      },
      Number(process.env.MODBUS_TIMEOUT_MS || 10000),
      Number(process.env.MODBUS_REQUEST_GAP_MS || 30),
    );
  }

  async start(): Promise<void> {
    this.rooms = await this.topologyService.getRooms();

    await this.mqtt.start({
      onSyncMessage: async (message) => {
        await this.handleRemoteMessage(message);
      },
      onPanelStateMessage: async (message) => {
        this.insightsStore.applyPanelStateMessage(message);
      },
    });

    void this.runPanelLoop();
    void this.runAircoLoop();
    void this.runTopologyLoop();

    console.log('[SyncMainLoop] started');
  }

  async stop(): Promise<void> {
    this.isStopped = true;

    if (this.panelTimer) {
      clearTimeout(this.panelTimer);
      this.panelTimer = null;
    }

    if (this.aircoTimer) {
      clearTimeout(this.aircoTimer);
      this.aircoTimer = null;
    }

    if (this.topologyTimer) {
      clearTimeout(this.topologyTimer);
      this.topologyTimer = null;
    }

    await this.panelMonitor.stop();
    await this.mqtt.stop();

    console.log('[SyncMainLoop] stopped');
  }

  private buildMessage(
    message: Omit<
      SyncMessage,
      'schema' | 'messageId' | 'timestamp' | 'sourceInstanceId'
    >,
  ): SyncMessage {
    return {
      schema: 'aircotest.sync.v4',
      messageId: createMessageId(),
      sourceInstanceId: this.sourceInstanceId,
      timestamp: new Date().toISOString(),
      ...message,
    };
  }

  private async runPanelLoop(): Promise<void> {
    if (this.isStopped) {
      return;
    }

    try {
      await this.panelMonitor.pollRooms(this.rooms);
      this.echoGuard.cleanup();
    } catch (error) {
      console.error('[SyncMainLoop] panel loop failed', error);
    }

    if (!this.isStopped) {
      this.panelTimer = setTimeout(() => {
        void this.runPanelLoop();
      }, this.panelLoopMs);
    }
  }

  private async runAircoLoop(): Promise<void> {
    if (this.isStopped) {
      return;
    }

    try {
      await this.aircoMonitor.pollRooms(this.rooms);
      this.echoGuard.cleanup();
    } catch (error) {
      console.error('[SyncMainLoop] airco loop failed', error);
    }

    if (!this.isStopped) {
      this.aircoTimer = setTimeout(() => {
        void this.runAircoLoop();
      }, this.aircoLoopMs);
    }
  }

  private async runTopologyLoop(): Promise<void> {
    if (this.isStopped) {
      return;
    }

    try {
      this.rooms = await this.topologyService.getRooms();
    } catch (error) {
      console.error('[SyncMainLoop] topology refresh failed', error);
    }

    if (!this.isStopped) {
      this.topologyTimer = setTimeout(() => {
        void this.runTopologyLoop();
      }, this.topologyRefreshMs);
    }
  }

  private async handleRemoteMessage(message: SyncMessage): Promise<void> {
    console.log('[SyncMainLoop] remote mqtt message received', message);

    if (message.origin === 'panel') {
      await this.aircoMonitor.applyPanelChangeLocally(this.rooms, message);
      return;
    }

    if (message.origin === 'airco') {
      await this.panelMonitor.applyAircoChangeLocally(this.rooms, message);
    }
  }
}
