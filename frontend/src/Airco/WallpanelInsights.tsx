import { useEffect, useState } from 'react';
import axios from 'axios';
import WallpanelInsightPanelCard from './wallpanel-insights/WallpanelInsightPanelCard';
import WallpanelInsightsFilters from './wallpanel-insights/WallpanelInsightsFilters';
import type {
  InsightResponse,
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
  const [loading, setLoading] = useState(false);
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
        `http://localhost:3000/wallpanel-insights/rooms/${selectedZoneId}/${selectedRoomId}`,
      );

      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch wallpanel insights', err);
      setError('Failed to fetch wallpanel insights');
    } finally {
      setLoading(false);
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
    if (!selectedZoneId || !selectedRoomId) {
      return;
    }

    setLoading(true);
    const streamUrl = `http://localhost:3000/wallpanel-insights/stream/rooms/${selectedZoneId}/${selectedRoomId}`;
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

        <p className="notice" style={{ margin: 0 }}>
          {loading ? 'Connecting...' : 'Live via server events'}
        </p>
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
            <WallpanelInsightPanelCard key={panel.panelId} panel={panel} />
          ))}
        </div>
      )}
    </main>
  );
}
