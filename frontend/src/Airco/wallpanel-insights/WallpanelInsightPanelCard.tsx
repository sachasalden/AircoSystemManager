import type { InsightPanel } from './model';
import WallpanelInsightUnitCard from './WallpanelInsightUnitCard';

type WallpanelInsightPanelCardProps = {
  panel: InsightPanel;
  syncPaused: boolean;
  adminBusy: boolean;
  onReboot: (panel: InsightPanel, unitId: number) => void;
  onBaudrate: (panel: InsightPanel, baudrate: number) => void;
};

export default function WallpanelInsightPanelCard({
  panel,
  syncPaused,
  adminBusy,
  onReboot,
  onBaudrate,
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

        <div className="wallpanel-admin-row">
          <div className="wallpanel-baud-control">
            <span>Reboot</span>
            <div className="wallpanel-baud-options">
              {panel.terminalIds.map((unitId) => (
                <button
                  className="wallpanel-admin-btn danger"
                  key={unitId}
                  type="button"
                  disabled={!syncPaused || adminBusy}
                  onClick={() => onReboot(panel, unitId)}
                  title={
                    syncPaused
                      ? `Reboot terminal ${unitId}`
                      : 'Pause sync before reboot'
                  }
                >
                  {unitId}
                </button>
              ))}
            </div>
          </div>

          {syncPaused ? (
            <div className="wallpanel-baud-control">
              <span>Baudrate</span>
              <div className="wallpanel-baud-options">
                {[9600, 19200, 57600, 115200].map((baudrate) => (
                  <button
                    className="wallpanel-baud-option"
                    key={baudrate}
                    type="button"
                    disabled={adminBusy}
                    onClick={() => onBaudrate(panel, baudrate)}
                  >
                    {baudrate}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="wallpanel-admin-hint">
              Pause sync to set baudrate
            </div>
          )}
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
