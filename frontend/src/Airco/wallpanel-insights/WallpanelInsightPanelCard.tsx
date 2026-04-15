import type { InsightPanel } from './model';
import WallpanelInsightUnitCard from './WallpanelInsightUnitCard';

type WallpanelInsightPanelCardProps = {
  panel: InsightPanel;
};

export default function WallpanelInsightPanelCard({
  panel,
}: WallpanelInsightPanelCardProps) {
  return (
    <div className="climate-card">
      <div className="climate-card-inner">
        <div className="card-top">
          <div className="card-title">
            <div className="card-icon">📊</div>
            <div className="card-title-text">
              <h4>{panel.name}</h4>
              <p>
                {panel.ip}:{panel.port} • {panel.type ?? 'unknown'}
              </p>
            </div>
          </div>
        </div>

        {panel.status === 'error' ? (
          <div className="empty">
            Could not connect: {panel.error ?? 'Unknown error'}
          </div>
        ) : panel.units.length === 0 ? (
          <div className="empty">No terminal IDs configured</div>
        ) : (
          panel.units.map((unit) => (
            <WallpanelInsightUnitCard key={unit.unitId} unit={unit} />
          ))
        )}
      </div>
    </div>
  );
}
