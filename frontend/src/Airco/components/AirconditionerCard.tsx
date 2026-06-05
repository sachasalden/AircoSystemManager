import { useEffect, useState } from 'react';
import {
  normalizeAirconditionerDevice,
  type AirconditionerDevice,
  type EnvironmentDevice,
} from '../model';
import AirconditionerForm from './AirconditionerForm';

type AirconditionerCardProps = {
  device: AirconditionerDevice;
  environmentDevices: EnvironmentDevice[];
  supportedEnvironmentDeviceTypes: string[];
  onRemove: () => void;
  onSave: (updated: AirconditionerDevice) => Promise<void>;
};

export default function AirconditionerCard({
  device,
  environmentDevices,
  supportedEnvironmentDeviceTypes,
  onRemove,
  onSave,
}: AirconditionerCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const [editName, setEditName] = useState(device.name || '');
  const [editDeviceType, setEditDeviceType] = useState(device.deviceType);
  const [editEnvironmentDeviceId, setEditEnvironmentDeviceId] = useState(
    device.data.deviceId,
  );
  const [editTerminalId, setEditTerminalId] = useState(
    device.data.deviceTerminalId,
  );
  const [editRoomTemparatureAddress, setEditRoomTemparatureAddress] = useState(
    String(device.data.roomTemparatureAddress ?? ''),
  );
  const [
    editRoomTemparatureSetPointAddress,
    setEditRoomTemparatureSetPointAddress,
  ] = useState(String(device.data.roomTemparatureSetPointAddress ?? ''));
  const [editFanspeedAddress, setEditFanspeedAddress] = useState(
    String(device.data.fanspeedAddress ?? ''),
  );
  const [editFanspeedSetPointAddress, setEditFanspeedSetPointAddress] =
    useState(String(device.data.fanspeedSetPointAddress ?? ''));

  const [editMinTemperature, setEditMinTemperature] = useState<number | ''>(
    device.minTemperature,
  );
  const [editMaxTemperature, setEditMaxTemperature] = useState<number | ''>(
    device.maxTemperature,
  );
  const [editMinSetTemperature, setEditMinSetTemperature] = useState<
    number | ''
  >(device.minSetTemperature);
  const [editMaxSetTemperature, setEditMaxSetTemperature] = useState<
    number | ''
  >(device.maxSetTemperature);
  const [editMinFanspeed, setEditMinFanspeed] = useState<number | ''>(
    device.minFanspeed,
  );
  const [editMaxFanspeed, setEditMaxFanspeed] = useState<number | ''>(
    device.maxFanspeed,
  );
  const [editMinFanMode, setEditMinFanMode] = useState<number | ''>(
    device.minFanMode,
  );
  const [editMaxFanMode, setEditMaxFanMode] = useState<number | ''>(
    device.maxFanMode,
  );

  const linkedEnvironmentDevice = environmentDevices.find(
    (env) => env.id === device.data.deviceId,
  );

  useEffect(() => {
    setEditName(device.name || '');
    setEditDeviceType(device.deviceType);
    setEditEnvironmentDeviceId(device.data.deviceId);
    setEditTerminalId(device.data.deviceTerminalId);
    setEditRoomTemparatureAddress(
      String(device.data.roomTemparatureAddress ?? ''),
    );
    setEditRoomTemparatureSetPointAddress(
      String(device.data.roomTemparatureSetPointAddress ?? ''),
    );
    setEditFanspeedAddress(String(device.data.fanspeedAddress ?? ''));
    setEditFanspeedSetPointAddress(
      String(device.data.fanspeedSetPointAddress ?? ''),
    );
    setEditMinTemperature(device.minTemperature);
    setEditMaxTemperature(device.maxTemperature);
    setEditMinSetTemperature(device.minSetTemperature);
    setEditMaxSetTemperature(device.maxSetTemperature);
    setEditMinFanspeed(device.minFanspeed);
    setEditMaxFanspeed(device.maxFanspeed);
    setEditMinFanMode(device.minFanMode);
    setEditMaxFanMode(device.maxFanMode);
  }, [device]);

  function cancelEdit() {
    setIsEditing(false);
    setEditName(device.name || '');
    setEditDeviceType(device.deviceType);
    setEditEnvironmentDeviceId(device.data.deviceId);
    setEditTerminalId(device.data.deviceTerminalId);
    setEditRoomTemparatureAddress(
      String(device.data.roomTemparatureAddress ?? ''),
    );
    setEditRoomTemparatureSetPointAddress(
      String(device.data.roomTemparatureSetPointAddress ?? ''),
    );
    setEditFanspeedAddress(String(device.data.fanspeedAddress ?? ''));
    setEditFanspeedSetPointAddress(
      String(device.data.fanspeedSetPointAddress ?? ''),
    );
    setEditMinTemperature(device.minTemperature);
    setEditMaxTemperature(device.maxTemperature);
    setEditMinSetTemperature(device.minSetTemperature);
    setEditMaxSetTemperature(device.maxSetTemperature);
    setEditMinFanspeed(device.minFanspeed);
    setEditMaxFanspeed(device.maxFanspeed);
    setEditMinFanMode(device.minFanMode);
    setEditMaxFanMode(device.maxFanMode);
  }

  async function saveEdit(value: {
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
  }) {
    const selectedEnvDevice = environmentDevices.find(
      (env) => env.id === value.selectedEnvironmentDeviceId,
    );

    if (!selectedEnvDevice || !value.deviceType || !value.terminalId) {
      window.alert(
        'Environment device, device model en terminal id zijn verplicht.',
      );
      return;
    }

    await onSave(
      normalizeAirconditionerDevice({
        ...device,
        name: value.name,
        deviceType: value.deviceType,
        minTemperature:
          value.minTemperature === ''
            ? undefined
            : Number(value.minTemperature),
        maxTemperature:
          value.maxTemperature === ''
            ? undefined
            : Number(value.maxTemperature),
        minSetTemperature:
          value.minSetTemperature === ''
            ? undefined
            : Number(value.minSetTemperature),
        maxSetTemperature:
          value.maxSetTemperature === ''
            ? undefined
            : Number(value.maxSetTemperature),
        minFanspeed:
          value.minFanspeed === '' ? undefined : Number(value.minFanspeed),
        maxFanspeed:
          value.maxFanspeed === '' ? undefined : Number(value.maxFanspeed),
        minFanMode:
          value.minFanMode === '' ? undefined : Number(value.minFanMode),
        maxFanMode:
          value.maxFanMode === '' ? undefined : Number(value.maxFanMode),
        data: {
          ...device.data,
          deviceId: selectedEnvDevice.id,
          type: selectedEnvDevice.type,
          deviceTerminalId: value.terminalId,
          roomTemparatureAddress: value.roomTemparatureAddress,
          roomTemparatureSetPointAddress: value.roomTemparatureSetPointAddress,
          fanspeedAddress: value.fanspeedAddress,
          fanspeedSetPointAddress: value.fanspeedSetPointAddress,
        },
      }),
    );

    setIsEditing(false);
  }

  return (
    <div className="climate-card">
      <div className="climate-card-inner">
        <div className="card-top">
          <div className="card-title">
            <div className="card-icon">❄️</div>
            <div className="card-title-text">
              <h4>{device.name || 'Airconditioning'}</h4>
              <p>
                {device.deviceType} • terminal{' '}
                {device.data.deviceTerminalId || '—'}
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
            <div className="big-temp">
              {device.currentTemperature >= 0
                ? `${device.currentTemperature}°`
                : '—'}
            </div>

            <div className="current-row">
              <span>🎯</span>
              <span>Setpoint: {device.setTemperature}</span>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <p className="stat-label">System device</p>
                <p className="stat-value">
                  {linkedEnvironmentDevice
                    ? `${linkedEnvironmentDevice.name} (${linkedEnvironmentDevice.ip}:${linkedEnvironmentDevice.port})`
                    : 'Niet gekoppeld'}
                </p>
              </div>

              <div className="stat-card">
                <p className="stat-label">Adapter type</p>
                <p className="stat-value">{device.data.type}</p>
              </div>

              <div className="stat-card">
                <p className="stat-label">Terminal ID</p>
                <p className="stat-value">{device.data.deviceTerminalId}</p>
              </div>

              <div className="stat-card">
                <p className="stat-label">Fan speed</p>
                <p className="stat-value">
                  {device.currentFanspeed >= 0 ? device.currentFanspeed : '—'}
                </p>
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
          <AirconditionerForm
            initialValue={{
              name: editName,
              deviceType: editDeviceType,
              selectedEnvironmentDeviceId: editEnvironmentDeviceId,
              terminalId: editTerminalId,
              roomTemparatureAddress: editRoomTemparatureAddress,
              roomTemparatureSetPointAddress:
                editRoomTemparatureSetPointAddress,
              fanspeedAddress: editFanspeedAddress,
              fanspeedSetPointAddress: editFanspeedSetPointAddress,
              minTemperature: editMinTemperature,
              maxTemperature: editMaxTemperature,
              minSetTemperature: editMinSetTemperature,
              maxSetTemperature: editMaxSetTemperature,
              minFanspeed: editMinFanspeed,
              maxFanspeed: editMaxFanspeed,
              minFanMode: editMinFanMode,
              maxFanMode: editMaxFanMode,
            }}
            environmentDevices={environmentDevices}
            supportedEnvironmentDeviceTypes={supportedEnvironmentDeviceTypes}
            onSubmit={saveEdit}
            submitLabel="Save"
          />
        )}
      </div>
    </div>
  );
}
