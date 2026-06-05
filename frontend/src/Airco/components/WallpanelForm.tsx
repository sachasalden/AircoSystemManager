import { useEffect, useState } from 'react';
import type { WallpanelUnit, WallpanelVersion } from '../model';
import {
  Field,
  FormActions,
  NumberInput,
  SelectInput,
  TextInput,
} from './ClimateFormControls';

type WallpanelFormValue = {
  name: string;
  ip: string;
  port: number | '';
  modbusUnits: WallpanelUnit[];
};

type WallpanelFormProps = {
  initialValue?: Partial<WallpanelFormValue>;
  onSubmit: (value: WallpanelFormValue) => void;
  onCancel?: () => void;
  submitLabel?: string;
  resetLabel?: string;
};

export default function WallpanelForm({
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = 'Add',
  resetLabel = 'Reset',
}: WallpanelFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [ip, setIp] = useState(initialValue?.ip ?? '');
  const [port, setPort] = useState<number | ''>(initialValue?.port ?? 8000);
  const [newUnitId, setNewUnitId] = useState('');
  const [newUnitType, setNewUnitType] =
    useState<WallpanelVersion>('polarbear-v1');
  const [modbusUnits, setModbusUnits] = useState<WallpanelUnit[]>(
    initialValue?.modbusUnits ?? [],
  );

  useEffect(() => {
    setName(initialValue?.name ?? '');
    setIp(initialValue?.ip ?? '');
    setPort(initialValue?.port ?? 8000);
    setNewUnitId('');
    setNewUnitType('polarbear-v1');
    setModbusUnits(initialValue?.modbusUnits ?? []);
  }, [initialValue]);

  function resetForm() {
    setName(initialValue?.name ?? '');
    setIp(initialValue?.ip ?? '');
    setPort(initialValue?.port ?? 8000);
    setNewUnitId('');
    setNewUnitType('polarbear-v1');
    setModbusUnits(initialValue?.modbusUnits ?? []);
  }

  function addUnitIds() {
    if (!newUnitId) return;

    const idsToAdd = newUnitId
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => !Number.isNaN(value));

    setModbusUnits((state) =>
      [
        ...state,
        ...idsToAdd
          .filter((id) => !state.some((unit) => unit.id === id))
          .map((id) => ({ id, type: newUnitType })),
      ].sort((a, b) => a.id - b.id),
    );

    setNewUnitId('');
  }

  function removeUnitId(id: number) {
    setModbusUnits((state) => state.filter((unit) => unit.id !== id));
  }

  function setUnitVersion(id: number, type: WallpanelVersion) {
    setModbusUnits((state) =>
      state.map((unit) => (unit.id === id ? { ...unit, type } : unit)),
    );
  }

  return (
    <div className="climate-form">
      <Field label="Name" span={2}>
        <TextInput value={name} onChange={setName} />
      </Field>

      <Field label="IP Address" span={2}>
        <TextInput value={ip} onChange={setIp} />
      </Field>

      <Field label="Port">
        <NumberInput value={port} onChange={setPort} />
      </Field>

      <Field label="Unit IDs" span={2}>
        <div className="unit-add-row">
          <TextInput
            value={newUnitId}
            onChange={setNewUnitId}
            placeholder="Unit ID"
          />
          <SelectInput
            value={newUnitType}
            onChange={(value) => setNewUnitType(value as WallpanelVersion)}
          >
            <option value="polarbear-v1">polarbear-v1</option>
            <option value="polarbear-v3">polarbear-v3</option>
          </SelectInput>
          <button
            type="button"
            className="action-btn action-btn-primary"
            onClick={addUnitIds}
          >
            Add unit
          </button>
        </div>

        <div className="unit-config-list">
          {modbusUnits.length === 0 && <div className="empty">No unit IDs</div>}
          {modbusUnits.map((unit) => (
            <div className="unit-config-row" key={unit.id}>
              <strong>Unit {unit.id}</strong>
              <SelectInput
                value={unit.type}
                onChange={(value) =>
                  setUnitVersion(unit.id, value as WallpanelVersion)
                }
              >
                <option value="polarbear-v1">polarbear-v1</option>
                <option value="polarbear-v3">polarbear-v3</option>
              </SelectInput>
              <button
                type="button"
                className="action-btn action-btn-danger action-btn-small"
                onClick={() => removeUnitId(unit.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </Field>

      <FormActions>
        <button
          onClick={() =>
            onSubmit({
              name,
              ip,
              port,
              modbusUnits,
            })
          }
          className="action-btn action-btn-primary"
          type="button"
        >
          {submitLabel}
        </button>
        <button
          onClick={resetForm}
          className="action-btn action-btn-neutral"
          type="button"
        >
          {resetLabel}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="action-btn action-btn-neutral"
            type="button"
          >
            Cancel
          </button>
        )}
      </FormActions>
    </div>
  );
}
