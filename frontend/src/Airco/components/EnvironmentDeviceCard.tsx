import type { EnvironmentDevice } from '../model';

type EnvironmentDeviceCardProps = {
  device: EnvironmentDevice;
  onRemove: () => void;
};

export default function EnvironmentDeviceCard({
  device,
  onRemove,
}: EnvironmentDeviceCardProps) {
  return (
    <div className="climate-card">
      <div className="climate-card-inner">
        <div className="card-top">
          <div className="card-title">
            <div className="card-icon">🖥️</div>
            <div className="card-title-text">
              <h4>{device.name}</h4>
              <p>
                {device.type} • {device.ip}:{device.port}
              </p>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">ID</p>
            <p className="stat-value">{device.id}</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Bidirectional</p>
            <p className="stat-value">{device.bidirectional ? 'Yes' : 'No'}</p>
          </div>
        </div>

        <div className="card-btn-row">
          <button
            className="action-btn action-btn-danger"
            type="button"
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
