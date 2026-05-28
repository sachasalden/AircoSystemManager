import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from './api';
import WallpanelInsightPanelCard from './wallpanel-insights/WallpanelInsightPanelCard';
import WallpanelInsightsFilters from './wallpanel-insights/WallpanelInsightsFilters';
import type {
  InsightResponse,
  InsightPanel,
  PolarbearLoopStatus,
  WallpanelInsightsProps,
} from './wallpanel-insights/model';

export default function WallpanelInsights({
  zones,
  selectedZoneId,
  selectedRoomId,
  setSelectedZoneId,
  setSelectedRoomId,
}: WallpanelInsightsProps) {
  const [data, setData] = useState<InsightResponse | null>(null);
  const [syncStatus, setSyncStatus] = useState<PolarbearLoopStatus>({
    paused: false,
    running: false,
  });
  const [loading, setLoading] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [error, setError] = useState('');

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const selectedRoom = selectedZone?.rooms.find(
    (room) => room.id === selectedRoomId,
  );

  async function fetchInsights() {
    if (!selectedZoneId || !selectedRoomId) return;

    try {
      setLoading(true);
      setError('');

      const res = await axios.get(
        `${API_BASE}/wallpanel-insights/rooms/${selectedZoneId}/${selectedRoomId}`,
      );

      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch wallpanel insights', err);
      setError('Failed to fetch wallpanel insights');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSyncStatus() {
    try {
      const res = await axios.get(`${API_BASE}/wallpanel-insights/sync/status`);
      setSyncStatus(res.data.polarbearLoop);
    } catch (err) {
      console.error('Failed to fetch polarbear sync status', err);
    }
  }

  async function setSyncPaused(paused: boolean) {
    try {
      setAdminBusy(true);
      setAdminMessage('');

      const res = await axios.post(
        `${API_BASE}/wallpanel-insights/sync/${paused ? 'pause' : 'resume'}`,
      );

      setSyncStatus(res.data.polarbearLoop);
      setAdminMessage(paused ? 'Polarbear sync paused' : 'Polarbear sync resumed');
    } catch (err: any) {
      setAdminMessage(
        err?.response?.data?.message ||
          (paused ? 'Failed to pause sync' : 'Failed to resume sync'),
      );
    } finally {
      setAdminBusy(false);
    }
  }

  async function rebootPanel(panel: InsightPanel) {
    const ok = window.confirm(
      `Reboot wallpanel ${panel.name} terminals ${panel.terminalIds.join(', ')}?`,
    );

    if (!ok) return;

    try {
      setAdminBusy(true);
      setAdminMessage('');

      await axios.post(
        `${API_BASE}/wallpanel-insights/panels/${panel.panelId}/reboot`,
        { unitIds: panel.terminalIds },
      );

      setAdminMessage(`Reboot sent to ${panel.name}`);
    } catch (err: any) {
      setAdminMessage(err?.response?.data?.message || 'Failed to reboot panel');
    } finally {
      setAdminBusy(false);
      void fetchSyncStatus();
    }
  }

  async function setPanelBaudrate(panel: InsightPanel, baudrate: number) {
    const ok = window.confirm(
      `Set baudrate ${baudrate} for ${panel.name} terminals ${panel.terminalIds.join(', ')}?`,
    );

    if (!ok) return;

    try {
      setAdminBusy(true);
      setAdminMessage('');

      await axios.post(
        `${API_BASE}/wallpanel-insights/panels/${panel.panelId}/baudrate`,
        { unitIds: panel.terminalIds, baudrate },
      );

      setAdminMessage(`Baudrate ${baudrate} sent to ${panel.name}`);
    } catch (err: any) {
      setAdminMessage(err?.response?.data?.message || 'Failed to set baudrate');
    } finally {
      setAdminBusy(false);
      void fetchSyncStatus();
    }
  }

  useEffect(() => {
    setData(null);
    setError('');

    if (selectedZoneId && selectedRoomId) {
      void fetchInsights();
    }
  }, [selectedZoneId, selectedRoomId]);

  useEffect(() => {
    void fetchSyncStatus();

    const interval = window.setInterval(() => {
      void fetchSyncStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedZoneId || !selectedRoomId) {
      return;
    }

    setLoading(true);
    const streamUrl = `${API_BASE}/wallpanel-insights/stream/rooms/${selectedZoneId}/${selectedRoomId}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('insights', (event) => {
      try {
        const nextData = JSON.parse((event as MessageEvent).data) as InsightResponse;
        setData(nextData);
        setError('');
        setLoading(false);
      } catch (streamError) {
        console.error('Failed to parse wallpanel insights stream payload', streamError);
      }
    });

    eventSource.addEventListener('insights-error', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          message?: string;
        };
        setError(payload.message || 'Failed to stream wallpanel insights');
      } catch {
        setError('Failed to stream wallpanel insights');
      }
      setLoading(false);
    });

    eventSource.onerror = () => {
      setLoading(false);
    };

    return () => {
      eventSource.close();
    };
  }, [selectedZoneId, selectedRoomId]);

  return (
    <main className="climate-panel">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h5 className="climate-title">Wallpanel insights</h5>
          <p className="notice">Live Polarbear-data van de gekozen room.</p>
        </div>

        <div className="wallpanel-sync-toolbar">
          <span
            className={`sync-pill ${syncStatus.paused ? 'paused' : 'active'}`}
          >
            <span className="sync-dot" />
            {syncStatus.paused ? 'Sync paused' : 'Sync active'}
          </span>
          <button
            className="sync-action-btn"
            type="button"
            disabled={adminBusy || syncStatus.paused}
            onClick={() => void setSyncPaused(true)}
          >
            Pause sync
          </button>
          <button
            className="sync-action-btn primary"
            type="button"
            disabled={adminBusy || !syncStatus.paused}
            onClick={() => void setSyncPaused(false)}
          >
            Resume sync
          </button>
        </div>
      </div>

      <div className="wallpanel-admin-status">
        <span>{loading ? 'Connecting...' : 'Live via server events'}</span>
        {syncStatus.paused && syncStatus.queuedAircoMessages ? (
          <span>{syncStatus.queuedAircoMessages} queued airco changes</span>
        ) : null}
        {adminMessage ? <span>{adminMessage}</span> : null}
      </div>

      <WallpanelInsightsFilters
        zones={zones}
        selectedZoneId={selectedZoneId}
        selectedRoomId={selectedRoomId}
        selectedZone={selectedZone}
        onZoneChange={(zoneId) => {
          setSelectedZoneId(zoneId);
          setSelectedRoomId(null);
        }}
        onRoomChange={setSelectedRoomId}
      />

      {!selectedZone || !selectedRoom ? (
        <div className="empty">Select a zone and room first</div>
      ) : error ? (
        <div className="empty">{error}</div>
      ) : loading && !data ? (
        <div className="empty">Loading wallpanel data...</div>
      ) : data?.panels.length === 0 ? (
        <div className="empty">No wallpanel found in this room</div>
      ) : (
        <div className="cards-grid">
          {data?.panels.map((panel) => (
            <WallpanelInsightPanelCard
              key={panel.panelId}
              panel={panel}
              syncPaused={syncStatus.paused}
              adminBusy={adminBusy}
              onReboot={(targetPanel) => void rebootPanel(targetPanel)}
              onBaudrate={(targetPanel, baudrate) =>
                void setPanelBaudrate(targetPanel, baudrate)
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
