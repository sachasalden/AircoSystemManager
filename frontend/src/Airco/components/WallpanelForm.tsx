import { useEffect, useState } from 'react';
import type { WallpanelVersion } from '../model';
import {
  Field,
  FormActions,
  NumberInput,
  SelectInput,
  TextInput,
} from './ClimateFormControls';
import TerminalIdsField from './TerminalIdsField';

type WallpanelFormValue = {
  name: string;
  ip: string;
  version: WallpanelVersion;
  port: number | '';
  terminalIds: number[];
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
  const [version, setVersion] = useState<WallpanelVersion>(
    initialValue?.version ?? 'polarbear-v1',
  );
  const [port, setPort] = useState<number | ''>(initialValue?.port ?? 8000);
  const [newTerminalId, setNewTerminalId] = useState('');
  const [terminalIds, setTerminalIds] = useState<number[]>(
    initialValue?.terminalIds ?? [],
  );

  useEffect(() => {
    setName(initialValue?.name ?? '');
    setIp(initialValue?.ip ?? '');
    setVersion(initialValue?.version ?? 'polarbear-v1');
    setPort(initialValue?.port ?? 8000);
    setNewTerminalId('');
    setTerminalIds(initialValue?.terminalIds ?? []);
  }, [initialValue]);

  function resetForm() {
    setName(initialValue?.name ?? '');
    setIp(initialValue?.ip ?? '');
    setVersion(initialValue?.version ?? 'polarbear-v1');
    setPort(initialValue?.port ?? 8000);
    setNewTerminalId('');
    setTerminalIds(initialValue?.terminalIds ?? []);
  }

  function addTerminalId() {
    if (!newTerminalId) return;

    const idsToAdd = newTerminalId
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => !Number.isNaN(value));

    setTerminalIds((state) => {
      const next = new Set<number>(state);
      idsToAdd.forEach((id) => next.add(id));
      return Array.from(next).sort((a, b) => a - b);
    });

    setNewTerminalId('');
  }

  function removeTerminalId(id: number) {
    setTerminalIds((state) => state.filter((terminalId) => terminalId !== id));
  }

  return (
    <div className="climate-form">
      <Field label="Name" span={2}>
        <TextInput value={name} onChange={setName} />
      </Field>

      <Field label="IP Address" span={2}>
        <TextInput value={ip} onChange={setIp} />
      </Field>

      <Field label="Polarbear Version">
        <SelectInput
          value={version}
          onChange={(value) => setVersion(value as WallpanelVersion)}
        >
          <option value="polarbear-v1">polarbear-v1</option>
          <option value="polarbear-v2">polarbear-v2</option>
          <option value="polarbear-v3">polarbear-v3</option>
        </SelectInput>
      </Field>

      <Field label="Port">
        <NumberInput value={port} onChange={setPort} />
      </Field>

      <TerminalIdsField
        value={newTerminalId}
        ids={terminalIds}
        onInputChange={setNewTerminalId}
        onAdd={addTerminalId}
        onRemove={removeTerminalId}
      />

      <FormActions>
        <button
          onClick={() =>
            onSubmit({
              name,
              ip,
              version,
              port,
              terminalIds,
            })
          }
          className="btn add-btn"
          type="button"
        >
          {submitLabel}
        </button>
        <button onClick={resetForm} className="btn ghost-btn" type="button">
          {resetLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="btn ghost-btn" type="button">
            Cancel
          </button>
        )}
      </FormActions>
    </div>
  );
}
