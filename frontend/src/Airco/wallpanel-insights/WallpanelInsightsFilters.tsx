import type { InsightZone } from './model';

type WallpanelInsightsFiltersProps = {
  zones: InsightZone[];
  selectedZoneId: string | null;
  selectedRoomId: string | null;
  selectedZone?: InsightZone;
  onZoneChange: (zoneId: string | null) => void;
  onRoomChange: (roomId: string | null) => void;
};

export default function WallpanelInsightsFilters({
  zones,
  selectedZoneId,
  selectedRoomId,
  selectedZone,
  onZoneChange,
  onRoomChange,
}: WallpanelInsightsFiltersProps) {
  return (
    <div className="climate-form" style={{ marginBottom: 24 }}>
      <div className="field">
        <label className="field-label">Zone</label>
        <select
          className="browser-default"
          value={selectedZoneId ?? ''}
          onChange={(e) => onZoneChange(e.target.value || null)}
        >
          <option value="">Select zone</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label">Room</label>
        <select
          className="browser-default"
          value={selectedRoomId ?? ''}
          onChange={(e) => onRoomChange(e.target.value || null)}
          disabled={!selectedZone}
        >
          <option value="">Select room</option>
          {selectedZone?.rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
