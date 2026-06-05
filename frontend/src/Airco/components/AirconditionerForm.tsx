import { useEffect, useState } from 'react';
import { AIRCO_DEVICE_MODELS, getAircoDeviceDefaults } from '../model';
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
  roomTemparatureAddress?: string;
  roomTemparatureSetPointAddress?: string;
  fanspeedAddress?: string;
  fanspeedSetPointAddress?: string;
  minTemperature: number | '';
  maxTemperature: number | '';
  minSetTemperature: number | '';
  maxSetTemperature: number | '';
  minFanspeed: number | '';
  maxFanspeed: number | '';
  minFanMode: number | '';
  maxFanMode: number | '';
};

type AirconditionerFormProps = {
  initialValue?: Partial<AirconditionerFormValue>;
  environmentDevices: EnvironmentDevice[];
  supportedEnvironmentDeviceTypes: string[];
  onSubmit: (value: AirconditionerFormValue) => void;
  onCancel?: () => void;
  submitLabel?: string;
  resetLabel?: string;
};

export default function AirconditionerForm({
  initialValue,
  environmentDevices,
  supportedEnvironmentDeviceTypes,
  onSubmit,
  onCancel,
  submitLabel = 'Add',
  resetLabel = 'Reset',
}: AirconditionerFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [deviceType, setDeviceType] = useState(
    initialValue?.deviceType ?? AIRCO_DEVICE_MODELS[0],
  );
  const defaults = getAircoDeviceDefaults(deviceType);
  const [selectedEnvironmentDeviceId, setSelectedEnvironmentDeviceId] =
    useState(
      initialValue?.selectedEnvironmentDeviceId ??
        environmentDevices[0]?.id ??
        '',
    );
  const [terminalId, setTerminalId] = useState(initialValue?.terminalId ?? '');
  const [roomTemparatureAddress, setRoomTemparatureAddress] = useState(
    initialValue?.roomTemparatureAddress ?? '',
  );
  const [roomTemparatureSetPointAddress, setRoomTemparatureSetPointAddress] =
    useState(initialValue?.roomTemparatureSetPointAddress ?? '');
  const [fanspeedAddress, setFanspeedAddress] = useState(
    initialValue?.fanspeedAddress ?? '',
  );
  const [fanspeedSetPointAddress, setFanspeedSetPointAddress] = useState(
    initialValue?.fanspeedSetPointAddress ?? '',
  );
  const [minTemperature, setMinTemperature] = useState<number | ''>(
    initialValue?.minTemperature ?? defaults.minTemperature,
  );
  const [maxTemperature, setMaxTemperature] = useState<number | ''>(
    initialValue?.maxTemperature ?? defaults.maxTemperature,
  );
  const [minSetTemperature, setMinSetTemperature] = useState<number | ''>(
    initialValue?.minSetTemperature ?? defaults.minSetTemperature,
  );
  const [maxSetTemperature, setMaxSetTemperature] = useState<number | ''>(
    initialValue?.maxSetTemperature ?? defaults.maxSetTemperature,
  );
  const [minFanspeed, setMinFanspeed] = useState<number | ''>(
    initialValue?.minFanspeed ?? defaults.minFanspeed,
  );
  const [maxFanspeed, setMaxFanspeed] = useState<number | ''>(
    initialValue?.maxFanspeed ?? defaults.maxFanspeed,
  );
  const [minFanMode, setMinFanMode] = useState<number | ''>(
    initialValue?.minFanMode ?? defaults.minFanMode,
  );
  const [maxFanMode, setMaxFanMode] = useState<number | ''>(
    initialValue?.maxFanMode ?? defaults.maxFanMode,
  );

  const compatibleEnvironmentDevices = environmentDevices.filter((env) =>
    supportedEnvironmentDeviceTypes.includes(env.type),
  );
  const selectedEnvironmentDevice = compatibleEnvironmentDevices.find(
    (env) => env.id === selectedEnvironmentDeviceId,
  );
  const defaultEnvironmentDeviceId = compatibleEnvironmentDevices[0]?.id ?? '';
  const needsRegisterAddresses =
    selectedEnvironmentDevice?.type === 'HeinEnHopmanGooiland';

  useEffect(() => {
    const nextDeviceType = initialValue?.deviceType ?? AIRCO_DEVICE_MODELS[0];
    const nextDefaults = getAircoDeviceDefaults(nextDeviceType);

    setName(initialValue?.name ?? '');
    setDeviceType(nextDeviceType);
    setSelectedEnvironmentDeviceId(
      initialValue?.selectedEnvironmentDeviceId ?? defaultEnvironmentDeviceId,
    );
    setTerminalId(initialValue?.terminalId ?? '');
    setRoomTemparatureAddress(initialValue?.roomTemparatureAddress ?? '');
    setRoomTemparatureSetPointAddress(
      initialValue?.roomTemparatureSetPointAddress ?? '',
    );
    setFanspeedAddress(initialValue?.fanspeedAddress ?? '');
    setFanspeedSetPointAddress(initialValue?.fanspeedSetPointAddress ?? '');
    setMinTemperature(
      initialValue?.minTemperature ?? nextDefaults.minTemperature,
    );
    setMaxTemperature(
      initialValue?.maxTemperature ?? nextDefaults.maxTemperature,
    );
    setMinSetTemperature(
      initialValue?.minSetTemperature ?? nextDefaults.minSetTemperature,
    );
    setMaxSetTemperature(
      initialValue?.maxSetTemperature ?? nextDefaults.maxSetTemperature,
    );
    setMinFanspeed(initialValue?.minFanspeed ?? nextDefaults.minFanspeed);
    setMaxFanspeed(initialValue?.maxFanspeed ?? nextDefaults.maxFanspeed);
    setMinFanMode(initialValue?.minFanMode ?? nextDefaults.minFanMode);
    setMaxFanMode(initialValue?.maxFanMode ?? nextDefaults.maxFanMode);
  }, [defaultEnvironmentDeviceId, initialValue]);

  function resetForm() {
    const nextDeviceType = initialValue?.deviceType ?? AIRCO_DEVICE_MODELS[0];
    const nextDefaults = getAircoDeviceDefaults(nextDeviceType);

    setName(initialValue?.name ?? '');
    setDeviceType(nextDeviceType);
    setSelectedEnvironmentDeviceId(
      initialValue?.selectedEnvironmentDeviceId ?? defaultEnvironmentDeviceId,
    );
    setTerminalId(initialValue?.terminalId ?? '');
    setRoomTemparatureAddress(initialValue?.roomTemparatureAddress ?? '');
    setRoomTemparatureSetPointAddress(
      initialValue?.roomTemparatureSetPointAddress ?? '',
    );
    setFanspeedAddress(initialValue?.fanspeedAddress ?? '');
    setFanspeedSetPointAddress(initialValue?.fanspeedSetPointAddress ?? '');
    setMinTemperature(
      initialValue?.minTemperature ?? nextDefaults.minTemperature,
    );
    setMaxTemperature(
      initialValue?.maxTemperature ?? nextDefaults.maxTemperature,
    );
    setMinSetTemperature(
      initialValue?.minSetTemperature ?? nextDefaults.minSetTemperature,
    );
    setMaxSetTemperature(
      initialValue?.maxSetTemperature ?? nextDefaults.maxSetTemperature,
    );
    setMinFanspeed(initialValue?.minFanspeed ?? nextDefaults.minFanspeed);
    setMaxFanspeed(initialValue?.maxFanspeed ?? nextDefaults.maxFanspeed);
    setMinFanMode(initialValue?.minFanMode ?? nextDefaults.minFanMode);
    setMaxFanMode(initialValue?.maxFanMode ?? nextDefaults.maxFanMode);
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

      {needsRegisterAddresses && (
        <>
          <Field label="Room temp address">
            <TextInput
              value={roomTemparatureAddress}
              onChange={setRoomTemparatureAddress}
              placeholder="e.g. 40001"
            />
          </Field>

          <Field label="Setpoint address">
            <TextInput
              value={roomTemparatureSetPointAddress}
              onChange={setRoomTemparatureSetPointAddress}
              placeholder="e.g. 40002"
            />
          </Field>

          <Field label="Fan speed address">
            <TextInput
              value={fanspeedAddress}
              onChange={setFanspeedAddress}
              placeholder="e.g. 40003"
            />
          </Field>

          <Field label="Fan setpoint address">
            <TextInput
              value={fanspeedSetPointAddress}
              onChange={setFanspeedSetPointAddress}
              placeholder="e.g. 40004"
            />
          </Field>
        </>
      )}

      <Field label="Min temperature">
        <NumberInput
          value={minTemperature}
          onChange={setMinTemperature}
          placeholder={String(defaults.minTemperature)}
        />
      </Field>

      <Field label="Max temperature">
        <NumberInput
          value={maxTemperature}
          onChange={setMaxTemperature}
          placeholder={String(defaults.maxTemperature)}
        />
      </Field>

      <Field label="Min set temp">
        <NumberInput
          value={minSetTemperature}
          onChange={setMinSetTemperature}
          placeholder={String(defaults.minSetTemperature)}
        />
      </Field>

      <Field label="Max set temp">
        <NumberInput
          value={maxSetTemperature}
          onChange={setMaxSetTemperature}
          placeholder={String(defaults.maxSetTemperature)}
        />
      </Field>

      <Field label="Min fan speed">
        <NumberInput
          value={minFanspeed}
          onChange={setMinFanspeed}
          placeholder={String(defaults.minFanspeed)}
        />
      </Field>

      <Field label="Max fan speed">
        <NumberInput
          value={maxFanspeed}
          onChange={setMaxFanspeed}
          placeholder={String(defaults.maxFanspeed)}
        />
      </Field>

      <Field label="Min fan mode">
        <NumberInput
          value={minFanMode}
          onChange={setMinFanMode}
          placeholder={String(defaults.minFanMode)}
        />
      </Field>

      <Field label="Max fan mode">
        <NumberInput
          value={maxFanMode}
          onChange={setMaxFanMode}
          placeholder={String(defaults.maxFanMode)}
        />
      </Field>

      <FormActions>
        <button
          onClick={() =>
            onSubmit({
              name,
              deviceType,
              selectedEnvironmentDeviceId,
              terminalId,
              roomTemparatureAddress,
              roomTemparatureSetPointAddress,
              fanspeedAddress,
              fanspeedSetPointAddress,
              minTemperature,
              maxTemperature,
              minSetTemperature,
              maxSetTemperature,
              minFanspeed,
              maxFanspeed,
              minFanMode,
              maxFanMode,
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
