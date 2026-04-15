import { useEffect, useState } from 'react';
import { AIRCO_DEVICE_MODELS } from '../model';
import type { EnvironmentDevice } from '../model';
import {
  Field,
  FormActions,
  NumberInput,
  SelectInput,
  TextInput,
} from './ClimateFormControls';

type AirconditionerFormValue = {
  name: string;
  deviceType: string;
  selectedEnvironmentDeviceId: string;
  terminalId: string;
  minTemperature: number | '';
  maxTemperature: number | '';
  minSetTemperature: number | '';
  maxSetTemperature: number | '';
  minFanspeed: number | '';
  maxFanspeed: number | '';
};

type AirconditionerFormProps = {
  initialValue?: Partial<AirconditionerFormValue>;
  environmentDevices: EnvironmentDevice[];
  onSubmit: (value: AirconditionerFormValue) => void;
  onCancel?: () => void;
  submitLabel?: string;
  resetLabel?: string;
};

export default function AirconditionerForm({
  initialValue,
  environmentDevices,
  onSubmit,
  onCancel,
  submitLabel = 'Add',
  resetLabel = 'Reset',
}: AirconditionerFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [deviceType, setDeviceType] = useState(
    initialValue?.deviceType ?? AIRCO_DEVICE_MODELS[0],
  );
  const [selectedEnvironmentDeviceId, setSelectedEnvironmentDeviceId] = useState(
    initialValue?.selectedEnvironmentDeviceId ??
      environmentDevices[0]?.id ??
      '',
  );
  const [terminalId, setTerminalId] = useState(initialValue?.terminalId ?? '');
  const [minTemperature, setMinTemperature] = useState<number | ''>(
    initialValue?.minTemperature ?? 16,
  );
  const [maxTemperature, setMaxTemperature] = useState<number | ''>(
    initialValue?.maxTemperature ?? 30,
  );
  const [minSetTemperature, setMinSetTemperature] = useState<number | ''>(
    initialValue?.minSetTemperature ?? 16,
  );
  const [maxSetTemperature, setMaxSetTemperature] = useState<number | ''>(
    initialValue?.maxSetTemperature ?? 30,
  );
  const [minFanspeed, setMinFanspeed] = useState<number | ''>(
    initialValue?.minFanspeed ?? 0,
  );
  const [maxFanspeed, setMaxFanspeed] = useState<number | ''>(
    initialValue?.maxFanspeed ?? 4,
  );

  const compatibleEnvironmentDevices = environmentDevices.filter(
    (env) => env.type === 'HeinAndHopmanIpSystem',
  );

  useEffect(() => {
    setName(initialValue?.name ?? '');
    setDeviceType(initialValue?.deviceType ?? AIRCO_DEVICE_MODELS[0]);
    setSelectedEnvironmentDeviceId(
      initialValue?.selectedEnvironmentDeviceId ??
        environmentDevices[0]?.id ??
        '',
    );
    setTerminalId(initialValue?.terminalId ?? '');
    setMinTemperature(initialValue?.minTemperature ?? 16);
    setMaxTemperature(initialValue?.maxTemperature ?? 30);
    setMinSetTemperature(initialValue?.minSetTemperature ?? 16);
    setMaxSetTemperature(initialValue?.maxSetTemperature ?? 30);
    setMinFanspeed(initialValue?.minFanspeed ?? 0);
    setMaxFanspeed(initialValue?.maxFanspeed ?? 4);
  }, [environmentDevices, initialValue]);

  function resetForm() {
    setName(initialValue?.name ?? '');
    setDeviceType(initialValue?.deviceType ?? AIRCO_DEVICE_MODELS[0]);
    setSelectedEnvironmentDeviceId(
      initialValue?.selectedEnvironmentDeviceId ??
        environmentDevices[0]?.id ??
        '',
    );
    setTerminalId(initialValue?.terminalId ?? '');
    setMinTemperature(initialValue?.minTemperature ?? 16);
    setMaxTemperature(initialValue?.maxTemperature ?? 30);
    setMinSetTemperature(initialValue?.minSetTemperature ?? 16);
    setMaxSetTemperature(initialValue?.maxSetTemperature ?? 30);
    setMinFanspeed(initialValue?.minFanspeed ?? 0);
    setMaxFanspeed(initialValue?.maxFanspeed ?? 4);
  }

  return (
    <div className="climate-form">
      <Field label="Name" span={2}>
        <TextInput value={name} onChange={setName} />
      </Field>

      <Field label="Environment device" span={2}>
        <SelectInput
          value={selectedEnvironmentDeviceId}
          onChange={setSelectedEnvironmentDeviceId}
        >
          <option value="">Select environment device</option>
          {compatibleEnvironmentDevices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name} — {device.type} — {device.ip}:{device.port}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Device model" span={2}>
        <SelectInput value={deviceType} onChange={setDeviceType}>
          {AIRCO_DEVICE_MODELS.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Terminal ID">
        <TextInput value={terminalId} onChange={setTerminalId} />
      </Field>

      <Field label="Min temperature">
        <NumberInput value={minTemperature} onChange={setMinTemperature} />
      </Field>

      <Field label="Max temperature">
        <NumberInput value={maxTemperature} onChange={setMaxTemperature} />
      </Field>

      <Field label="Min set temp">
        <NumberInput value={minSetTemperature} onChange={setMinSetTemperature} />
      </Field>

      <Field label="Max set temp">
        <NumberInput value={maxSetTemperature} onChange={setMaxSetTemperature} />
      </Field>

      <Field label="Min fan speed">
        <NumberInput value={minFanspeed} onChange={setMinFanspeed} />
      </Field>

      <Field label="Max fan speed">
        <NumberInput value={maxFanspeed} onChange={setMaxFanspeed} />
      </Field>

      <FormActions>
        <button
          onClick={() =>
            onSubmit({
              name,
              deviceType,
              selectedEnvironmentDeviceId,
              terminalId,
              minTemperature,
              maxTemperature,
              minSetTemperature,
              maxSetTemperature,
              minFanspeed,
              maxFanspeed,
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
