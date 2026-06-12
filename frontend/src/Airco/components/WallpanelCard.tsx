import { useEffect, useState } from 'react';
import type {
  WallpanelDevice,
  WallpanelUnit,
  WallpanelVersion,
} from '../model';
import {
  Field,
  NumberInput,
  SelectInput,
  TextInput,
} from './ClimateFormControls';
import ConfirmModal from './ConfirmModal';

type WallpanelCardProps = {
  device: WallpanelDevice;
  onRemove: () => void;
  onSave: (updated: {
    id: string;
    name?: string;
    ip: string;
    type?: string;
    port: number;
    ids: number[];
    modbusUnits: WallpanelUnit[];
  }) => Promise<void>;
};

export default function WallpanelCard({
  device,
  onRemove,
  onSave,
}: WallpanelCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const initialUnits =
    device.modbusUnits?.length && device.modbusUnits.length > 0
      ? device.modbusUnits
      : (device.ids || []).map((id) => ({
          id,
          type: (device.version || 'polarbear-v1') as WallpanelVersion,
        }));

  const [editName, setEditName] = useState(device.name || '');
  const [editIp, setEditIp] = useState(device.ip);
  const [editPort, setEditPort] = useState<number | ''>(device.port);
  const [editNewUnitId, setEditNewUnitId] = useState('');
  const [editNewUnitType, setEditNewUnitType] =
    useState<WallpanelVersion>('polarbear-v1');
  const [editUnits, setEditUnits] = useState<WallpanelUnit[]>(initialUnits);
  const [unitToRemove, setUnitToRemove] = useState<number | null>(null);

  useEffect(() => {
    const unitsNow =
      device.modbusUnits?.length && device.modbusUnits.length > 0
        ? device.modbusUnits
        : (device.ids || []).map((id) => ({
            id,
            type: (device.version || 'polarbear-v1') as WallpanelVersion,
          }));

    setEditName(device.name || '');
    setEditIp(device.ip);
    setEditPort(device.port);
    setEditUnits(unitsNow);
    setEditNewUnitId('');
    setEditNewUnitType('polarbear-v1');
    setUnitToRemove(null);
  }, [device]);

  const unitsText = initialUnits.length
    ? initialUnits.map((unit) => `${unit.id} (${unit.type})`).join(', ')
    : '—';

  function addEditUnitIds() {
    if (!editNewUnitId) return;

    const idsToAdd = editNewUnitId
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => !Number.isNaN(value));

    setEditUnits((state) =>
      [
        ...state,
        ...idsToAdd
          .filter((id) => !state.some((unit) => unit.id === id))
          .map((id) => ({ id, type: editNewUnitType })),
      ].sort((a, b) => a.id - b.id),
    );

    setEditNewUnitId('');
  }

  function confirmRemoveEditUnitId() {
    if (unitToRemove === null) {
      return;
    }

    setEditUnits((state) => state.filter((unit) => unit.id !== unitToRemove));
    setUnitToRemove(null);
  }

  function setEditUnitVersion(id: number, type: WallpanelVersion) {
    setEditUnits((state) =>
      state.map((unit) => (unit.id === id ? { ...unit, type } : unit)),
    );
  }

  function cancelEdit() {
    const unitsNow =
      device.modbusUnits?.length && device.modbusUnits.length > 0
        ? device.modbusUnits
        : (device.ids || []).map((id) => ({
            id,
            type: (device.version || 'polarbear-v1') as WallpanelVersion,
          }));

    setIsEditing(false);
    setEditName(device.name || '');
    setEditIp(device.ip);
    setEditPort(device.port);
    setEditUnits(unitsNow);
    setEditNewUnitId('');
    setEditNewUnitType('polarbear-v1');
    setUnitToRemove(null);
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
      type: 'moxa',
      port: editPort === '' ? 0 : Number(editPort),
      ids: editUnits.map((unit) => unit.id),
      modbusUnits: editUnits,
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
                {device.ip}:{device.port} • {device.type || 'moxa'}
              </p>
            </div>
          </div>

          <div className="card-actions">
            {!isEditing ? (
              <button
                className="action-btn action-btn-neutral action-btn-small"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
            ) : (
              <button
                className="action-btn action-btn-neutral action-btn-small"
                type="button"
                onClick={cancelEdit}
              >
                Close
              </button>
            )}
          </div>
        </div>

        {!isEditing ? (
          <>
            <div className="big-temp">Moxa</div>
            <div className="current-row">
              <span>🔌</span>
              <span>Units: {unitsText}</span>
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
              <button
                className="action-btn action-btn-danger"
                type="button"
                onClick={onRemove}
              >
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

              <Field label="Port">
                <NumberInput value={editPort} onChange={setEditPort} />
              </Field>

              <Field label="Unit IDs" span={2}>
                <div className="unit-add-row">
                  <TextInput
                    value={editNewUnitId}
                    onChange={setEditNewUnitId}
                    placeholder="Unit ID"
                  />
                  <SelectInput
                    value={editNewUnitType}
                    onChange={(value) =>
                      setEditNewUnitType(value as WallpanelVersion)
                    }
                  >
                    <option value="polarbear-v1">polarbear-v1</option>
                    <option value="polarbear-v3">polarbear-v3</option>
                  </SelectInput>
                  <button
                    type="button"
                    className="action-btn action-btn-primary"
                    onClick={addEditUnitIds}
                  >
                    Add unit
                  </button>
                </div>

                <div className="unit-config-list">
                  {editUnits.length === 0 && (
                    <div className="empty">No unit IDs</div>
                  )}
                  {editUnits.map((unit) => (
                    <div className="unit-config-row" key={unit.id}>
                      <strong>Unit {unit.id}</strong>
                      <SelectInput
                        value={unit.type}
                        onChange={(value) =>
                          setEditUnitVersion(unit.id, value as WallpanelVersion)
                        }
                      >
                        <option value="polarbear-v1">polarbear-v1</option>
                        <option value="polarbear-v3">polarbear-v3</option>
                      </SelectInput>
                      <button
                        type="button"
                        className="action-btn action-btn-danger action-btn-small"
                        onClick={() => setUnitToRemove(unit.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </Field>
            </div>

            <div className="card-btn-row">
              <button
                className="action-btn action-btn-neutral"
                type="button"
                onClick={cancelEdit}
              >
                Cancel
              </button>
              <button
                className="action-btn action-btn-primary"
                type="button"
                onClick={saveEdit}
              >
                Save
              </button>
            </div>
          </>
        )}
      </div>
      <ConfirmModal
        title="Remove unit"
        message={`Are you sure you want to remove unit ${unitToRemove ?? ''}?`}
        open={unitToRemove !== null}
        onCancel={() => setUnitToRemove(null)}
        onConfirm={confirmRemoveEditUnitId}
      />
    </div>
  );
}
