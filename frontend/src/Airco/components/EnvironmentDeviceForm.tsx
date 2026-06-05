import { useEffect, useState } from 'react';
import { AIRCO_ADAPTER_TYPES } from '../model';
import {
  CheckboxField,
  Field,
  FormActions,
  SelectInput,
  TextInput,
} from './ClimateFormControls';

type EnvironmentDeviceFormValue = {
  name: string;
  type: string;
  ip: string;
  port: string;
  bidirectional: boolean;
};

type EnvironmentDeviceFormProps = {
  initialValue?: Partial<EnvironmentDeviceFormValue>;
  availableTypes: string[];
  onSubmit: (value: EnvironmentDeviceFormValue) => void;
};

export default function EnvironmentDeviceForm({
  initialValue,
  availableTypes,
  onSubmit,
}: EnvironmentDeviceFormProps) {
  const typeOptions =
    availableTypes.length > 0 ? availableTypes : [...AIRCO_ADAPTER_TYPES];
  const defaultType = typeOptions[0] ?? '';

  const [name, setName] = useState(initialValue?.name ?? 'New');
  const [type, setType] = useState(initialValue?.type ?? defaultType);
  const [ip, setIp] = useState(initialValue?.ip ?? '');
  const [port, setPort] = useState(initialValue?.port ?? '502');
  const [bidirectional, setBidirectional] = useState(
    initialValue?.bidirectional ?? true,
  );

  useEffect(() => {
    setName(initialValue?.name ?? 'New');
    setType(initialValue?.type ?? defaultType);
    setIp(initialValue?.ip ?? '');
    setPort(initialValue?.port ?? '');
    setBidirectional(initialValue?.bidirectional ?? true);
  }, [initialValue, defaultType]);

  function resetForm() {
    setName(initialValue?.name ?? 'New');
    setType(initialValue?.type ?? defaultType);
    setIp(initialValue?.ip ?? '');
    setPort(initialValue?.port ?? '');
    setBidirectional(initialValue?.bidirectional ?? true);
  }

  return (
    <div className="climate-form">
      <Field label="Name" span={2}>
        <TextInput
          value={name}
          onChange={setName}
          placeholder="e.g. DEV Server emulator"
        />
      </Field>

      <Field label="Type" span={2}>
        <SelectInput value={type} onChange={setType}>
          {typeOptions.map((adapterType) => (
            <option key={adapterType} value={adapterType}>
              {adapterType}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="IP">
        <TextInput value={ip} onChange={setIp} placeholder="192.168.xx.xx" />
      </Field>

      <Field label="Port">
        <TextInput value={port} onChange={setPort} placeholder="502" />
      </Field>

      <Field label="Bidirectional communication" span={2}>
        <CheckboxField
          label="Enabled"
          checked={bidirectional}
          onChange={setBidirectional}
        />
      </Field>

      <FormActions>
        <button
          onClick={() =>
            onSubmit({
              name,
              type,
              ip,
              port,
              bidirectional,
            })
          }
          className="action-btn action-btn-primary"
          type="button"
        >
          Add airco system device
        </button>
        <button
          onClick={resetForm}
          className="action-btn action-btn-neutral"
          type="button"
        >
          Reset
        </button>
      </FormActions>
    </div>
  );
}
