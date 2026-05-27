import { useEffect, useState } from 'react';
import type { WallpanelDevice, WallpanelVersion } from '../model';
import {
  Field,
  NumberInput,
  SelectInput,
  TextInput,
} from './ClimateFormControls';
import TerminalIdsField from './TerminalIdsField';

type WallpanelCardProps = {
  device: WallpanelDevice;
  onRemove: () => void;
  onSave: (updated: {
    id: string;
    name?: string;
    ip: string;
    type?: WallpanelVersion;
    port: number;
    ids: number[];
  }) => Promise<void>;
};

export default function WallpanelCard({
  device,
  onRemove,
  onSave,
}: WallpanelCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const initialIds =
    device.terminalIds?.length && device.terminalIds.length > 0
      ? device.terminalIds
      : device.ids || [];

  const [editName, setEditName] = useState(device.name || '');
  const [editIp, setEditIp] = useState(device.ip);
  const [editType, setEditType] = useState<WallpanelVersion>(
    (device.version as WallpanelVersion) || 'polarbear-v1',
  );
  const [editPort, setEditPort] = useState<number | ''>(device.port);
  const [editNewTerminalId, setEditNewTerminalId] = useState('');
  const [editTerminalIds, setEditTerminalIds] = useState<number[]>(initialIds);

  useEffect(() => {
    const idsNow =
      device.terminalIds?.length && device.terminalIds.length > 0
        ? device.terminalIds
        : device.ids || [];

    setEditName(device.name || '');
    setEditIp(device.ip);
    setEditType((device.version as WallpanelVersion) || 'polarbear-v1');
    setEditPort(device.port);
    setEditTerminalIds(idsNow);
    setEditNewTerminalId('');
  }, [device]);

  const terminalsText = initialIds.length ? initialIds.join(', ') : '—';

  function addEditTerminalId() {
    if (!editNewTerminalId) return;

    const idsToAdd = editNewTerminalId
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => !Number.isNaN(value));

    setEditTerminalIds((state) => {
      const next = new Set<number>(state);
      idsToAdd.forEach((id) => next.add(id));
      return Array.from(next).sort((a, b) => a - b);
    });

    setEditNewTerminalId('');
  }

  function removeEditTerminalId(id: number) {
    setEditTerminalIds((state) => state.filter((terminalId) => terminalId !== id));
  }

  function cancelEdit() {
    const idsNow =
      device.terminalIds?.length && device.terminalIds.length > 0
        ? device.terminalIds
        : device.ids || [];

    setIsEditing(false);
    setEditName(device.name || '');
    setEditIp(device.ip);
    setEditType((device.version as WallpanelVersion) || 'polarbear-v1');
    setEditPort(device.port);
    setEditTerminalIds(idsNow);
    setEditNewTerminalId('');
  }

  async function saveEdit() {
    if (!editIp) {
      window.alert('IP Address is required.');
      return;
    }

    await onSave({
      id: device.id,
      name: editName,
      ip: editIp,
      type: editType,
      port: editPort === '' ? 0 : Number(editPort),
      ids: [...editTerminalIds],
    });

    setIsEditing(false);
  }

  return (
    <div className="climate-card">
      <div className="climate-card-inner">
        <div className="card-top">
          <div className="card-title">
            <div className="card-icon">🧊</div>
            <div className="card-title-text">
              <h4>{device.name || 'Wallpanel'}</h4>
              <p>
                {device.ip}:{device.port} • {device.version || device.type || 'unknown'}
              </p>
            </div>
          </div>

          <div className="card-actions">
            {!isEditing ? (
              <button
                className="circle-btn"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
            ) : (
              <button className="circle-btn" type="button" onClick={cancelEdit}>
                ✕
              </button>
            )}
          </div>
        </div>

        {!isEditing ? (
          <>
            <div className="big-temp">Moxa</div>
            <div className="current-row">
              <span>🔌</span>
              <span>Wallpanels: {terminalsText}</span>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <p className="stat-label">IP</p>
                <p className="stat-value">{device.ip}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Port</p>
                <p className="stat-value">{device.port}</p>
              </div>
            </div>

            <div className="card-btn-row">
              <button className="btn ghost-btn" type="button" onClick={onRemove}>
                Remove
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="edit-grid">
              <Field label="Name" span={2}>
                <TextInput value={editName} onChange={setEditName} />
              </Field>

              <Field label="IP Address" span={2}>
                <TextInput value={editIp} onChange={setEditIp} />
              </Field>

              <Field label="Polarbear Version">
                <SelectInput
                  value={editType}
                  onChange={(value) => setEditType(value as WallpanelVersion)}
                >
                  <option value="polarbear-v1">polarbear-v1</option>
                  <option value="polarbear-v3">polarbear-v3</option>
                </SelectInput>
              </Field>

              <Field label="Port">
                <NumberInput value={editPort} onChange={setEditPort} />
              </Field>

              <TerminalIdsField
                value={editNewTerminalId}
                ids={editTerminalIds}
                onInputChange={setEditNewTerminalId}
                onAdd={addEditTerminalId}
                onRemove={removeEditTerminalId}
              />
            </div>

            <div className="card-btn-row">
              <button className="btn ghost-btn" type="button" onClick={cancelEdit}>
                Cancel
              </button>
              <button className="btn add-btn" type="button" onClick={saveEdit}>
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
