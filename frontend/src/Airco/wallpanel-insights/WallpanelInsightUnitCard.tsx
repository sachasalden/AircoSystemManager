import type { InsightUnit } from './model';
import { valueOrDash } from './model';

type WallpanelInsightUnitCardProps = {
  unit: InsightUnit;
};

export default function WallpanelInsightUnitCard({
  unit,
}: WallpanelInsightUnitCardProps) {
  return (
    <div style={{ marginTop: 16 }}>
      <h5>Terminal {unit.unitId}</h5>

      <div className="stats-grid">
        {unit.zones.map((zone) => (
          <div className="stat-card" key={zone.zone}>
            <p className="stat-label">Zone {zone.zone}</p>

            {zone.status === 'error' ? (
              <p className="stat-value">{zone.error}</p>
            ) : (
              <>
                <p>Setpoint: {valueOrDash(zone.setpoint)}°</p>
                <p>Virtual temp: {valueOrDash(zone.virtualTemperature)}°</p>
                <p>Fan speed: {valueOrDash(zone.fanSpeed)}</p>
                <p>Fan mode: {valueOrDash(zone.fanMode)}</p>
                <p>Flags: {valueOrDash(zone.flags)}</p>
                <p>Pending setpoint: {valueOrDash(zone.pendingSetpoint)}°</p>
                <p>Pending fan mode: {valueOrDash(zone.pendingFanMode)}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
