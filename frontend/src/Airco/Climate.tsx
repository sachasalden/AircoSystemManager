import { useEffect, useState } from 'react';
import axios from 'axios';
import './climate.css';

type WallpanelVersion = 'polarbear-v1' | 'polarbear-v2' | 'polarbear-v3';

type EnvironmentDevice = {
  id: string;
  name: string;
  type: string;
  ip: string;
  port: string;
  bidirectional: boolean;
};

type WallpanelDevice = {
  id: string;
  name?: string;
  ip: string;
  version?: WallpanelVersion;
  port: number;
  terminalIds?: number[];
  zoneId?: string;
  roomId?: string;
  ids?: number[];
  type?: string;
};

type AirconditionerDevice = {
  id: string;
  name?: string;
  deviceType: string;
  minTemperature: number;
  maxTemperature: number;
  minSetTemperature: number;
  maxSetTemperature: number;
  setTemperature: number;
  currentTemperature: number;
  currentFanspeed: number;
  minFanspeed: number;
  maxFanspeed: number;
  data: {
    deviceId: string;
    type: string;
    deviceTerminalId: string;
  };
  zoneId?: string;
  roomId?: string;
};

type Room = {
  id: string;
  name: string;
  aircopanels: WallpanelDevice[];
  airconditioners: AirconditionerDevice[];
};

type Zone = {
  id: string;
  name: string;
  rooms: Room[];
};

type ApiWallpanelDevice = Partial<WallpanelDevice>;

type ApiAirconditionerDevice = Partial<AirconditionerDevice> & {
  data?: Partial<AirconditionerDevice['data']>;
};

type ApiRoom = {
  id?: string;
  name?: string;
  aircopanels?: ApiWallpanelDevice[];
  airconditioners?: ApiAirconditionerDevice[];
};

type ApiZone = {
  id?: string;
  _id?: string;
  name?: string;
  rooms?: ApiRoom[];
};

const AIRCO_DEVICE_MODELS = [
  'FC-500PC/FC-1100PC',
  'FC-3000DC/FC-3500DC',
] as const;

const AIRCO_ADAPTER_TYPES = ['HeinAndHopmanIpSystem'] as const;

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEnvironmentDevice(
  device: Partial<EnvironmentDevice>,
): EnvironmentDevice {
  return {
    id: String(device.id ?? ''),
    name: device.name ?? 'New',
    type: device.type ?? AIRCO_ADAPTER_TYPES[0],
    ip: device.ip ?? '',
    port: String(device.port ?? '502'),
    bidirectional: Boolean(device.bidirectional),
  };
}

function normalizeWallpanelDevice(
  device?: ApiWallpanelDevice,
): WallpanelDevice {
  const idsSource = Array.isArray(device?.terminalIds)
    ? device.terminalIds
    : Array.isArray(device?.ids)
      ? device.ids
      : [];

  const ids = idsSource
    .map((id) => toNumber(id, NaN))
    .filter((id) => Number.isFinite(id));

  const version = (device?.version ||
    device?.type ||
    'polarbear-v1') as WallpanelVersion;

  return {
    id: String(device?.id ?? ''),
    name: device?.name ?? '',
    ip: device?.ip ?? '',
    version,
    type: device?.type ?? version,
    port: toNumber(device?.port, 4001),
    terminalIds: ids,
    ids,
    zoneId: device?.zoneId,
    roomId: device?.roomId,
  };
}

function normalizeAirconditionerDevice(
  device?: ApiAirconditionerDevice,
): AirconditionerDevice {
  const minTemperature = toNumber(device?.minTemperature, 16);
  const maxTemperature = toNumber(device?.maxTemperature, 30);
  const minSetTemperature = toNumber(device?.minSetTemperature, minTemperature);
  const maxSetTemperature = toNumber(device?.maxSetTemperature, maxTemperature);
  const minFanspeed = toNumber(device?.minFanspeed, 0);
  const maxFanspeed = toNumber(device?.maxFanspeed, 4);

  let setTemperature = toNumber(device?.setTemperature, minSetTemperature);

  if (setTemperature < minSetTemperature) {
    setTemperature = minSetTemperature;
  }

  if (setTemperature > maxSetTemperature) {
    setTemperature = maxSetTemperature;
  }

  return {
    id: String(device?.id ?? ''),
    name: device?.name ?? '',
    deviceType: device?.deviceType ?? AIRCO_DEVICE_MODELS[0],
    minTemperature,
    maxTemperature,
    minSetTemperature,
    maxSetTemperature,
    setTemperature,
    currentTemperature: toNumber(device?.currentTemperature, -1),
    currentFanspeed: toNumber(device?.currentFanspeed, -1),
    minFanspeed,
    maxFanspeed,
    data: {
      deviceId: String(device?.data?.deviceId ?? ''),
      type: String(device?.data?.type ?? AIRCO_ADAPTER_TYPES[0]),
      deviceTerminalId: String(device?.data?.deviceTerminalId ?? ''),
    },
    zoneId: device?.zoneId,
    roomId: device?.roomId,
  };
}

function normalizeRoom(room?: ApiRoom): Room {
  return {
    id: String(room?.id ?? ''),
    name: room?.name ?? '',
    aircopanels: Array.isArray(room?.aircopanels)
      ? room.aircopanels.map((panel) => normalizeWallpanelDevice(panel))
      : [],
    airconditioners: Array.isArray(room?.airconditioners)
      ? room.airconditioners.map((airco) =>
          normalizeAirconditionerDevice(airco),
        )
      : [],
  };
}

function normalizeZones(raw: ApiZone[]): Zone[] {
  return (raw || []).map((zone) => ({
    id: String(zone.id ?? zone._id ?? ''),
    name: zone.name ?? '',
    rooms: Array.isArray(zone.rooms)
      ? zone.rooms.map((room) => normalizeRoom(room))
      : [],
  }));
}

function WallpanelCard({
  device,
  onRemove,
  onSave,
}: {
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
}) {
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
      .map((p) => Number(p.trim()))
      .filter((n) => !Number.isNaN(n));

    setEditTerminalIds((s) => {
      const set = new Set<number>(s);
      idsToAdd.forEach((id) => set.add(id));
      return Array.from(set).sort((a, b) => a - b);
    });

    setEditNewTerminalId('');
  }

  function removeEditTerminalId(id: number) {
    setEditTerminalIds((s) => s.filter((t) => t !== id));
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
                {device.ip}:{device.port} •{' '}
                {device.version || device.type || 'unknown'}
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
            <div className="big-temp">Wallpanel</div>
            <div className="current-row">
              <span>🔌</span>
              <span>Terminals: {terminalsText}</span>
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
                className="btn ghost-btn"
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
              <div className="field span-2">
                <label className="field-label">Name</label>
                <input
                  className="text-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="field span-2">
                <label className="field-label">IP Address</label>
                <input
                  className="text-input"
                  value={editIp}
                  onChange={(e) => setEditIp(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label">Polarbear Version</label>
                <select
                  className="browser-default"
                  value={editType}
                  onChange={(e) =>
                    setEditType(e.target.value as WallpanelVersion)
                  }
                >
                  <option value="polarbear-v1">polarbear-v1</option>
                  <option value="polarbear-v2">polarbear-v2</option>
                  <option value="polarbear-v3">polarbear-v3</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">Port</label>
                <input
                  className="text-input"
                  type="number"
                  value={editPort}
                  onChange={(e) =>
                    setEditPort(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </div>

              <div className="field span-2">
                <label className="field-label">Terminal IDs</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="text-input"
                    value={editNewTerminalId}
                    onChange={(e) => setEditNewTerminalId(e.target.value)}
                    placeholder="e.g. 1,2,3"
                  />
                  <button
                    type="button"
                    className="btn add-btn"
                    onClick={addEditTerminalId}
                  >
                    Add ID
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 8,
                  }}
                >
                  {editTerminalIds.length === 0 && (
                    <div className="empty">No terminal IDs</div>
                  )}
                  {editTerminalIds.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="btn ghost-btn"
                      onClick={() => removeEditTerminalId(t)}
                    >
                      Terminal {t} ✕
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card-btn-row">
              <button
                className="btn ghost-btn"
                type="button"
                onClick={cancelEdit}
              >
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

function AirconditionerCard({
  device,
  environmentDevices,
  onRemove,
  onSave,
}: {
  device: AirconditionerDevice;
  environmentDevices: EnvironmentDevice[];
  onRemove: () => void;
  onSave: (updated: AirconditionerDevice) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [editName, setEditName] = useState(device.name || '');
  const [editDeviceType, setEditDeviceType] = useState(device.deviceType);
  const [editEnvironmentDeviceId, setEditEnvironmentDeviceId] = useState(
    device.data.deviceId,
  );
  const [editTerminalId, setEditTerminalId] = useState(
    device.data.deviceTerminalId,
  );

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

  const linkedEnvironmentDevice = environmentDevices.find(
    (env) => env.id === device.data.deviceId,
  );

  useEffect(() => {
    setEditName(device.name || '');
    setEditDeviceType(device.deviceType);
    setEditEnvironmentDeviceId(device.data.deviceId);
    setEditTerminalId(device.data.deviceTerminalId);
    setEditMinTemperature(device.minTemperature);
    setEditMaxTemperature(device.maxTemperature);
    setEditMinSetTemperature(device.minSetTemperature);
    setEditMaxSetTemperature(device.maxSetTemperature);
    setEditMinFanspeed(device.minFanspeed);
    setEditMaxFanspeed(device.maxFanspeed);
  }, [device]);

  function cancelEdit() {
    setIsEditing(false);
    setEditName(device.name || '');
    setEditDeviceType(device.deviceType);
    setEditEnvironmentDeviceId(device.data.deviceId);
    setEditTerminalId(device.data.deviceTerminalId);
    setEditMinTemperature(device.minTemperature);
    setEditMaxTemperature(device.maxTemperature);
    setEditMinSetTemperature(device.minSetTemperature);
    setEditMaxSetTemperature(device.maxSetTemperature);
    setEditMinFanspeed(device.minFanspeed);
    setEditMaxFanspeed(device.maxFanspeed);
  }

  async function saveEdit() {
    const selectedEnvDevice = environmentDevices.find(
      (env) => env.id === editEnvironmentDeviceId,
    );

    if (!selectedEnvDevice || !editDeviceType || !editTerminalId) {
      window.alert(
        'Environment device, device model en terminal id zijn verplicht.',
      );
      return;
    }

    await onSave(
      normalizeAirconditionerDevice({
        ...device,
        name: editName,
        deviceType: editDeviceType,
        minTemperature:
          editMinTemperature === '' ? undefined : Number(editMinTemperature),
        maxTemperature:
          editMaxTemperature === '' ? undefined : Number(editMaxTemperature),
        minSetTemperature:
          editMinSetTemperature === ''
            ? undefined
            : Number(editMinSetTemperature),
        maxSetTemperature:
          editMaxSetTemperature === ''
            ? undefined
            : Number(editMaxSetTemperature),
        minFanspeed:
          editMinFanspeed === '' ? undefined : Number(editMinFanspeed),
        maxFanspeed:
          editMaxFanspeed === '' ? undefined : Number(editMaxFanspeed),
        data: {
          deviceId: selectedEnvDevice.id,
          type: selectedEnvDevice.type,
          deviceTerminalId: editTerminalId,
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
                className="btn ghost-btn"
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
              <div className="field span-2">
                <label className="field-label">Name</label>
                <input
                  className="text-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="field span-2">
                <label className="field-label">Environment device</label>
                <select
                  className="browser-default"
                  value={editEnvironmentDeviceId}
                  onChange={(e) => setEditEnvironmentDeviceId(e.target.value)}
                >
                  <option value="">Select environment device</option>
                  {environmentDevices
                    .filter((env) => env.type === 'HeinAndHopmanIpSystem')
                    .map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name} — {env.type} — {env.ip}:{env.port}
                      </option>
                    ))}
                </select>
              </div>

              <div className="field span-2">
                <label className="field-label">Device model</label>
                <select
                  className="browser-default"
                  value={editDeviceType}
                  onChange={(e) => setEditDeviceType(e.target.value)}
                >
                  {AIRCO_DEVICE_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">Terminal ID</label>
                <input
                  className="text-input"
                  value={editTerminalId}
                  onChange={(e) => setEditTerminalId(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label">Min temperature</label>
                <input
                  className="text-input"
                  type="number"
                  value={editMinTemperature}
                  onChange={(e) =>
                    setEditMinTemperature(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </div>

              <div className="field">
                <label className="field-label">Max temperature</label>
                <input
                  className="text-input"
                  type="number"
                  value={editMaxTemperature}
                  onChange={(e) =>
                    setEditMaxTemperature(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </div>

              <div className="field">
                <label className="field-label">Min set temp</label>
                <input
                  className="text-input"
                  type="number"
                  value={editMinSetTemperature}
                  onChange={(e) =>
                    setEditMinSetTemperature(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </div>

              <div className="field">
                <label className="field-label">Max set temp</label>
                <input
                  className="text-input"
                  type="number"
                  value={editMaxSetTemperature}
                  onChange={(e) =>
                    setEditMaxSetTemperature(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </div>

              <div className="field">
                <label className="field-label">Min fan speed</label>
                <input
                  className="text-input"
                  type="number"
                  value={editMinFanspeed}
                  onChange={(e) =>
                    setEditMinFanspeed(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </div>

              <div className="field">
                <label className="field-label">Max fan speed</label>
                <input
                  className="text-input"
                  type="number"
                  value={editMaxFanspeed}
                  onChange={(e) =>
                    setEditMaxFanspeed(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>

            <div className="card-btn-row">
              <button
                className="btn ghost-btn"
                type="button"
                onClick={cancelEdit}
              >
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

export default function Climate() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [environmentDevices, setEnvironmentDevices] = useState<
    EnvironmentDevice[]
  >([]);

  const [activeView, setActiveView] = useState<'zones' | 'aircoSystemDevices'>(
    'zones',
  );

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [panelToDelete, setPanelToDelete] = useState<string | null>(null);

  const [aircoModalOpen, setAircoModalOpen] = useState(false);
  const [aircoToDelete, setAircoToDelete] = useState<string | null>(null);

  const [showAircoForm, setShowAircoForm] = useState(false);

  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [version, setVersion] = useState<WallpanelVersion>('polarbear-v1');
  const [port, setPort] = useState<number | ''>(8000);
  const [newTerminalId, setNewTerminalId] = useState('');
  const [terminalIds, setTerminalIds] = useState<number[]>([]);

  const [envName, setEnvName] = useState('New');
  const [envType, setEnvType] = useState('HeinAndHopmanIpSystem');
  const [envIp, setEnvIp] = useState('');
  const [envPort, setEnvPort] = useState('502');
  const [envBidirectional, setEnvBidirectional] = useState(true);

  const [aircoName, setAircoName] = useState('');
  const [aircoDeviceType, setAircoDeviceType] = useState<string>(
    AIRCO_DEVICE_MODELS[0],
  );
  const [selectedEnvironmentDeviceId, setSelectedEnvironmentDeviceId] =
    useState('');
  const [aircoTerminalId, setAircoTerminalId] = useState('');
  const [aircoMinTemperature, setAircoMinTemperature] = useState<number | ''>(
    16,
  );
  const [aircoMaxTemperature, setAircoMaxTemperature] = useState<number | ''>(
    30,
  );
  const [aircoMinSetTemperature, setAircoMinSetTemperature] = useState<
    number | ''
  >(16);
  const [aircoMaxSetTemperature, setAircoMaxSetTemperature] = useState<
    number | ''
  >(30);
  const [aircoMinFanspeed, setAircoMinFanspeed] = useState<number | ''>(0);
  const [aircoMaxFanspeed, setAircoMaxFanspeed] = useState<number | ''>(4);

  useEffect(() => {
    async function fetchData() {
      try {
        const [zonesRes, environmentDevicesRes] = await Promise.all([
          axios.get('http://localhost:3000/devices'),
          axios.get('http://localhost:3000/environment-devices'),
        ]);

        const rawEnvironmentDevices = Array.isArray(environmentDevicesRes.data)
          ? environmentDevicesRes.data
          : [];

        const normalizedEnvironmentDevices = rawEnvironmentDevices.map(
          (device: Partial<EnvironmentDevice>) =>
            normalizeEnvironmentDevice(device),
        );

        setZones(normalizeZones(zonesRes.data));
        setEnvironmentDevices(normalizedEnvironmentDevices);

        if (normalizedEnvironmentDevices.length > 0) {
          setSelectedEnvironmentDeviceId(normalizedEnvironmentDevices[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch climate data', err);
      }
    }

    fetchData();
  }, []);

  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const selectedRoom = selectedZone?.rooms.find((r) => r.id === selectedRoomId);

  function resetForm() {
    setName('');
    setIp('');
    setVersion('polarbear-v1');
    setPort(8000);
    setNewTerminalId('');
    setTerminalIds([]);
  }

  function resetEnvironmentDeviceForm() {
    setEnvName('New');
    setEnvType('HeinAndHopmanIpSystem');
    setEnvIp('');
    setEnvPort('502');
    setEnvBidirectional(true);
  }

  function resetAircoForm() {
    setAircoName('');
    setAircoDeviceType(AIRCO_DEVICE_MODELS[0]);
    setSelectedEnvironmentDeviceId(environmentDevices[0]?.id || '');
    setAircoTerminalId('');
    setAircoMinTemperature(16);
    setAircoMaxTemperature(30);
    setAircoMinSetTemperature(16);
    setAircoMaxSetTemperature(30);
    setAircoMinFanspeed(0);
    setAircoMaxFanspeed(4);
  }

  async function addEnvironmentDevice() {
    if (!envName || !envType || !envIp || !envPort) {
      window.alert('Name, type, ip en port zijn verplicht.');
      return;
    }

    try {
      const res = await axios.post(
        'http://localhost:3000/environment-devices',
        {
          name: envName,
          type: envType,
          ip: envIp,
          port: envPort,
          bidirectional: envBidirectional,
        },
      );

      const normalizedDevice = normalizeEnvironmentDevice(res.data);

      setEnvironmentDevices((prev) => [...prev, normalizedDevice]);
      setSelectedEnvironmentDeviceId(normalizedDevice.id);
      resetEnvironmentDeviceForm();
    } catch (err) {
      console.error('Failed to add environment device', err);
      window.alert('Failed to add environment device');
    }
  }

  async function deleteEnvironmentDevice(id: string) {
    const isUsed = zones.some((zone) =>
      zone.rooms.some((room) =>
        room.airconditioners.some((airco) => airco.data.deviceId === id),
      ),
    );

    if (isUsed) {
      window.alert(
        'Dit system device wordt nog gebruikt door een airconditioner.',
      );
      return;
    }

    try {
      await axios.delete(`http://localhost:3000/environment-devices/${id}`);

      const remaining = environmentDevices.filter((device) => device.id !== id);
      setEnvironmentDevices(remaining);

      if (selectedEnvironmentDeviceId === id) {
        setSelectedEnvironmentDeviceId(remaining[0]?.id || '');
      }
    } catch (err) {
      console.error('Failed to delete environment device', err);
      window.alert('Failed to delete environment device');
    }
  }

  async function addWallpanel() {
    if (!selectedZoneId || !selectedRoomId) {
      window.alert('Select a zone and room first.');
      return;
    }

    if (!ip) {
      window.alert('IP Address is required.');
      return;
    }

    const roomWithPanel = selectedZone?.rooms.find(
      (r) => r.id === selectedRoomId && r.aircopanels.length > 0,
    );

    if (roomWithPanel) {
      window.alert(
        'This room already has a wallpanel. Only one wallpanel is allowed per room.',
      );
      return;
    }

    const device = {
      zoneId: selectedZoneId,
      roomId: selectedRoomId,
      name,
      ip,
      type: version,
      port: port === '' ? 0 : Number(port),
      ids: [...terminalIds],
    };

    try {
      const res = await axios.post('http://localhost:3000/devices', device);
      const normalizedPanel = normalizeWallpanelDevice(res.data);

      setZones((prevZones) =>
        prevZones.map((zone) =>
          zone.id !== selectedZoneId
            ? zone
            : {
                ...zone,
                rooms: zone.rooms.map((room) =>
                  room.id !== selectedRoomId
                    ? room
                    : {
                        ...room,
                        aircopanels: [...room.aircopanels, normalizedPanel],
                      },
                ),
              },
        ),
      );

      resetForm();
    } catch (err) {
      console.error('Failed to add device', err);
      window.alert('Failed to add wallpanel');
    }
  }

  async function addAirconditioner() {
    if (!selectedZoneId || !selectedRoomId) {
      window.alert('Select a zone and room first.');
      return;
    }

    const selectedEnvDevice = environmentDevices.find(
      (device) => device.id === selectedEnvironmentDeviceId,
    );

    if (!selectedEnvDevice || !aircoDeviceType || !aircoTerminalId) {
      window.alert(
        'Environment device, device model en terminal id zijn verplicht.',
      );
      return;
    }

    const device = {
      zoneId: selectedZoneId,
      roomId: selectedRoomId,
      name: aircoName,
      deviceType: aircoDeviceType,
      minTemperature:
        aircoMinTemperature === '' ? undefined : Number(aircoMinTemperature),
      maxTemperature:
        aircoMaxTemperature === '' ? undefined : Number(aircoMaxTemperature),
      minSetTemperature:
        aircoMinSetTemperature === ''
          ? undefined
          : Number(aircoMinSetTemperature),
      maxSetTemperature:
        aircoMaxSetTemperature === ''
          ? undefined
          : Number(aircoMaxSetTemperature),
      setTemperature:
        aircoMinSetTemperature === '' ? 16 : Number(aircoMinSetTemperature),
      currentTemperature: -1,
      currentFanspeed: -1,
      minFanspeed:
        aircoMinFanspeed === '' ? undefined : Number(aircoMinFanspeed),
      maxFanspeed:
        aircoMaxFanspeed === '' ? undefined : Number(aircoMaxFanspeed),
      data: {
        deviceId: selectedEnvDevice.id,
        type: selectedEnvDevice.type,
        deviceTerminalId: aircoTerminalId,
      },
    };

    try {
      const res = await axios.post(
        'http://localhost:3000/airco-devices',
        device,
      );
      const normalizedAirco = normalizeAirconditionerDevice(res.data);

      setZones((prevZones) =>
        prevZones.map((zone) =>
          zone.id !== selectedZoneId
            ? zone
            : {
                ...zone,
                rooms: zone.rooms.map((room) =>
                  room.id !== selectedRoomId
                    ? room
                    : {
                        ...room,
                        airconditioners: [
                          ...room.airconditioners,
                          normalizedAirco,
                        ],
                      },
                ),
              },
        ),
      );

      resetAircoForm();
      setShowAircoForm(false);
    } catch (err) {
      console.error('Failed to add airconditioner', err);
      window.alert('Failed to add airconditioner');
    }
  }

  function addTerminalId() {
    if (!newTerminalId) return;

    const idsToAdd = newTerminalId
      .split(',')
      .map((p) => Number(p.trim()))
      .filter((n) => !Number.isNaN(n));

    setTerminalIds((s) => {
      const set = new Set<number>(s);
      idsToAdd.forEach((id) => set.add(id));
      return Array.from(set).sort((a, b) => a - b);
    });

    setNewTerminalId('');
  }

  function removeTerminalId(id: number) {
    setTerminalIds((s) => s.filter((t) => t !== id));
  }

  async function updateWallpanel(updated: {
    id: string;
    name?: string;
    ip: string;
    type?: WallpanelVersion;
    port: number;
    ids: number[];
  }) {
    if (!selectedZoneId || !selectedRoomId) return;

    try {
      const res = await axios.put(
        `http://localhost:3000/devices/${updated.id}`,
        updated,
      );

      const normalizedPanel = normalizeWallpanelDevice(res.data);

      setZones((prevZones) =>
        prevZones.map((zone) =>
          zone.id !== selectedZoneId
            ? zone
            : {
                ...zone,
                rooms: zone.rooms.map((room) =>
                  room.id !== selectedRoomId
                    ? room
                    : {
                        ...room,
                        aircopanels: room.aircopanels.map((p) =>
                          p.id !== updated.id ? p : normalizedPanel,
                        ),
                      },
                ),
              },
        ),
      );
    } catch (err) {
      console.error('Failed to update device', err);
      window.alert('Failed to update wallpanel');
    }
  }

  async function updateAirconditioner(updated: AirconditionerDevice) {
    if (!selectedZoneId || !selectedRoomId) return;

    try {
      const res = await axios.put(
        `http://localhost:3000/airco-devices/${updated.id}`,
        updated,
      );

      const normalizedAirco = normalizeAirconditionerDevice(res.data);

      setZones((prevZones) =>
        prevZones.map((zone) =>
          zone.id !== selectedZoneId
            ? zone
            : {
                ...zone,
                rooms: zone.rooms.map((room) =>
                  room.id !== selectedRoomId
                    ? room
                    : {
                        ...room,
                        airconditioners: room.airconditioners.map((a) =>
                          a.id !== updated.id ? a : normalizedAirco,
                        ),
                      },
                ),
              },
        ),
      );
    } catch (err) {
      console.error('Failed to update airconditioner', err);
      window.alert('Failed to update airconditioner');
    }
  }

  async function confirmDeleteWallpanel() {
    if (!panelToDelete || !selectedZoneId || !selectedRoomId) return;

    try {
      await axios.delete(`http://localhost:3000/devices/${panelToDelete}`);

      setZones((prevZones) =>
        prevZones.map((zone) =>
          zone.id !== selectedZoneId
            ? zone
            : {
                ...zone,
                rooms: zone.rooms.map((room) =>
                  room.id !== selectedRoomId
                    ? room
                    : {
                        ...room,
                        aircopanels: room.aircopanels.filter(
                          (p) => p.id !== panelToDelete,
                        ),
                      },
                ),
              },
        ),
      );
    } catch (err) {
      console.error('Failed to delete device', err);
      window.alert('Failed to delete wallpanel');
    } finally {
      setModalOpen(false);
      setPanelToDelete(null);
    }
  }

  async function confirmDeleteAirco() {
    if (!aircoToDelete || !selectedZoneId || !selectedRoomId) return;

    try {
      await axios.delete(
        `http://localhost:3000/airco-devices/${aircoToDelete}`,
      );

      setZones((prevZones) =>
        prevZones.map((zone) =>
          zone.id !== selectedZoneId
            ? zone
            : {
                ...zone,
                rooms: zone.rooms.map((room) =>
                  room.id !== selectedRoomId
                    ? room
                    : {
                        ...room,
                        airconditioners: room.airconditioners.filter(
                          (a) => a.id !== aircoToDelete,
                        ),
                      },
                ),
              },
        ),
      );
    } catch (err) {
      console.error('Failed to delete airconditioner', err);
      window.alert('Failed to delete airconditioner');
    } finally {
      setAircoModalOpen(false);
      setAircoToDelete(null);
    }
  }

  return (
    <div className="climate-wrapper">
      <aside className="side-menu" aria-label="Climate navigation">
        <h4>Climate</h4>

        <button
          className={`menu-item ${
            activeView === 'aircoSystemDevices' ? 'active' : ''
          }`}
          onClick={() => {
            setActiveView('aircoSystemDevices');
            setSelectedZoneId(null);
            setSelectedRoomId(null);
            setShowAircoForm(false);
          }}
        >
          Airco system devices
        </button>

        <h4 style={{ marginTop: 24 }}>Zones</h4>

        {zones.map((zone) => (
          <button
            key={zone.id}
            className={`menu-item ${
              activeView === 'zones' && selectedZoneId === zone.id
                ? 'active'
                : ''
            }`}
            onClick={() => {
              setActiveView('zones');
              setSelectedZoneId(zone.id);
              setSelectedRoomId(null);
              setShowAircoForm(false);
            }}
          >
            {zone.name}
          </button>
        ))}
      </aside>

      <div className="climate-content">
        {activeView === 'aircoSystemDevices' ? (
          <main className="climate-panel">
            <h5 className="climate-title">Airco system devices</h5>

            <div className="climate-form">
              <div className="field span-2">
                <label className="field-label">Name</label>
                <input
                  className="text-input"
                  value={envName}
                  onChange={(e) => setEnvName(e.target.value)}
                  placeholder="e.g. DEV Server emulator"
                />
              </div>

              <div className="field span-2">
                <label className="field-label">Type</label>
                <select
                  className="browser-default"
                  value={envType}
                  onChange={(e) => setEnvType(e.target.value)}
                >
                  {AIRCO_ADAPTER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">IP</label>
                <input
                  className="text-input"
                  value={envIp}
                  onChange={(e) => setEnvIp(e.target.value)}
                  placeholder="192.168.55.10"
                />
              </div>

              <div className="field">
                <label className="field-label">Port</label>
                <input
                  className="text-input"
                  value={envPort}
                  onChange={(e) => setEnvPort(e.target.value)}
                  placeholder="502"
                />
              </div>

              <div className="field span-2">
                <label className="field-label">
                  Bidirectional communication
                </label>
                <label
                  style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                >
                  <input
                    type="checkbox"
                    checked={envBidirectional}
                    onChange={(e) => setEnvBidirectional(e.target.checked)}
                  />
                  Enabled
                </label>
              </div>

              <div className="form-actions">
                <button
                  onClick={addEnvironmentDevice}
                  className="btn add-btn"
                  type="button"
                >
                  Add airco system device
                </button>
                <button
                  onClick={resetEnvironmentDeviceForm}
                  className="btn ghost-btn"
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="cards-grid" style={{ marginTop: 24 }}>
              {environmentDevices.length === 0 ? (
                <div className="empty">No airco system devices yet</div>
              ) : (
                environmentDevices.map((device) => (
                  <div className="climate-card" key={device.id}>
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
                          <p className="stat-value">
                            {device.bidirectional ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </div>

                      <div className="card-btn-row">
                        <button
                          className="btn ghost-btn"
                          type="button"
                          onClick={() => deleteEnvironmentDevice(device.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              {selectedZone && (
                <>
                  <h4>Rooms in {selectedZone.name}</h4>
                  {selectedZone.rooms.map((room) => (
                    <button
                      key={room.id}
                      className={`menu-item ${
                        selectedRoomId === room.id ? 'active' : ''
                      }`}
                      onClick={() => {
                        setSelectedRoomId(room.id);
                        setShowAircoForm(false);
                      }}
                      style={{ marginRight: 8, marginBottom: 8 }}
                    >
                      {room.name}
                    </button>
                  ))}
                </>
              )}
            </div>

            {selectedRoom ? (
              <>
                <h4>Wallpanels</h4>

                <div className="cards-grid">
                  {selectedRoom.aircopanels.length === 0 ? (
                    <div className="climate-panel">
                      <div className="empty">No wallpanels in this room</div>
                    </div>
                  ) : (
                    selectedRoom.aircopanels.map((panel) => (
                      <WallpanelCard
                        key={panel.id}
                        device={panel}
                        onRemove={() => {
                          setPanelToDelete(panel.id);
                          setModalOpen(true);
                        }}
                        onSave={updateWallpanel}
                      />
                    ))
                  )}
                </div>

                <div
                  style={{
                    marginTop: 32,
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <h4 style={{ margin: 0 }}>Airconditioners</h4>
                  <button
                    type="button"
                    className="btn add-btn"
                    onClick={() => setShowAircoForm((s) => !s)}
                  >
                    {showAircoForm ? 'Close' : 'New AC'}
                  </button>
                </div>

                {showAircoForm && (
                  <main className="climate-panel" style={{ marginBottom: 24 }}>
                    <h5 className="climate-title">
                      Airconditioning — Add device
                    </h5>

                    <div className="climate-form">
                      <div className="field span-2">
                        <label className="field-label">Name</label>
                        <input
                          className="text-input"
                          value={aircoName}
                          onChange={(e) => setAircoName(e.target.value)}
                        />
                      </div>

                      <div className="field span-2">
                        <label className="field-label">
                          Environment device
                        </label>
                        <select
                          className="browser-default"
                          value={selectedEnvironmentDeviceId}
                          onChange={(e) =>
                            setSelectedEnvironmentDeviceId(e.target.value)
                          }
                        >
                          <option value="">Select environment device</option>
                          {environmentDevices
                            .filter((env) => env.type === 'HeinAndHopmanIpSystem',)
                            .map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.name} — {device.type} — {device.ip}:
                                {device.port}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="field span-2">
                        <label className="field-label">Device model</label>
                        <select
                          className="browser-default"
                          value={aircoDeviceType}
                          onChange={(e) => setAircoDeviceType(e.target.value)}
                        >
                          {AIRCO_DEVICE_MODELS.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label className="field-label">Terminal ID</label>
                        <input
                          className="text-input"
                          value={aircoTerminalId}
                          onChange={(e) => setAircoTerminalId(e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <label className="field-label">Min temperature</label>
                        <input
                          className="text-input"
                          type="number"
                          value={aircoMinTemperature}
                          onChange={(e) =>
                            setAircoMinTemperature(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label className="field-label">Max temperature</label>
                        <input
                          className="text-input"
                          type="number"
                          value={aircoMaxTemperature}
                          onChange={(e) =>
                            setAircoMaxTemperature(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label className="field-label">Min set temp</label>
                        <input
                          className="text-input"
                          type="number"
                          value={aircoMinSetTemperature}
                          onChange={(e) =>
                            setAircoMinSetTemperature(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label className="field-label">Max set temp</label>
                        <input
                          className="text-input"
                          type="number"
                          value={aircoMaxSetTemperature}
                          onChange={(e) =>
                            setAircoMaxSetTemperature(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label className="field-label">Min fan speed</label>
                        <input
                          className="text-input"
                          type="number"
                          value={aircoMinFanspeed}
                          onChange={(e) =>
                            setAircoMinFanspeed(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label className="field-label">Max fan speed</label>
                        <input
                          className="text-input"
                          type="number"
                          value={aircoMaxFanspeed}
                          onChange={(e) =>
                            setAircoMaxFanspeed(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>

                      <div className="form-actions">
                        <button
                          onClick={addAirconditioner}
                          className="btn add-btn"
                          type="button"
                        >
                          Add
                        </button>
                        <button
                          onClick={resetAircoForm}
                          className="btn ghost-btn"
                          type="button"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => {
                            resetAircoForm();
                            setShowAircoForm(false);
                          }}
                          className="btn ghost-btn"
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </main>
                )}

                <div className="cards-grid">
                  {selectedRoom.airconditioners.length === 0 ? (
                    <div className="climate-panel">
                      <div className="empty">
                        No airconditioners in this room
                      </div>
                    </div>
                  ) : (
                    selectedRoom.airconditioners.map((airco) => (
                      <AirconditionerCard
                        key={airco.id}
                        device={airco}
                        environmentDevices={environmentDevices}
                        onRemove={() => {
                          setAircoToDelete(airco.id);
                          setAircoModalOpen(true);
                        }}
                        onSave={updateAirconditioner}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="climate-panel">
                <div className="empty">
                  {selectedZone
                    ? 'Select a room to see devices'
                    : 'Select a zone to see rooms'}
                </div>
              </div>
            )}

            {selectedZone && selectedRoom && (
              <>
                {selectedRoom.aircopanels.length === 0 ? (
                  <main className="climate-panel" style={{ marginTop: 24 }}>
                    <h5 className="climate-title">Wallpanel — Add device</h5>

                    <div className="climate-form">
                      <div className="field span-2">
                        <label className="field-label">Name</label>
                        <input
                          className="text-input"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>

                      <div className="field span-2">
                        <label className="field-label">IP Address</label>
                        <input
                          className="text-input"
                          value={ip}
                          onChange={(e) => setIp(e.target.value)}
                        />
                      </div>

                      <div className="field">
                        <label className="field-label">Polarbear Version</label>
                        <select
                          className="browser-default"
                          value={version}
                          onChange={(e) =>
                            setVersion(e.target.value as WallpanelVersion)
                          }
                        >
                          <option value="polarbear-v1">polarbear-v1</option>
                          <option value="polarbear-v2">polarbear-v2</option>
                          <option value="polarbear-v3">polarbear-v3</option>
                        </select>
                      </div>

                      <div className="field">
                        <label className="field-label">Port</label>
                        <input
                          className="text-input"
                          type="number"
                          value={port}
                          onChange={(e) =>
                            setPort(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>

                      <div className="field span-2">
                        <label className="field-label">Terminal IDs</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            className="text-input"
                            value={newTerminalId}
                            onChange={(e) => setNewTerminalId(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn add-btn"
                            onClick={addTerminalId}
                          >
                            Add ID
                          </button>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginTop: 8,
                          }}
                        >
                          {terminalIds.length === 0 && (
                            <div className="empty">No terminal IDs</div>
                          )}
                          {terminalIds.map((t) => (
                            <button
                              key={t}
                              type="button"
                              className="btn ghost-btn"
                              onClick={() => removeTerminalId(t)}
                            >
                              Terminal {t} ✕
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          onClick={addWallpanel}
                          className="btn add-btn"
                          type="button"
                        >
                          Add
                        </button>
                        <button
                          onClick={resetForm}
                          className="btn ghost-btn"
                          type="button"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </main>
                ) : (
                  <main className="climate-panel" style={{ marginTop: 24 }}>
                    <h5 className="climate-title">Wallpanel — Add device</h5>
                    <p className="notice">
                      This room already has a wallpanel. Only one wallpanel is
                      allowed per room.
                    </p>
                  </main>
                )}
              </>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <div className="wp-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Remove wallpanel</h4>
            <p>Are you sure you want to remove this wallpanel?</p>

            <div className="wp-modal-actions">
              <button
                className="btn ghost-btn"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn add-btn"
                type="button"
                onClick={confirmDeleteWallpanel}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {aircoModalOpen && (
        <div
          className="wp-modal-backdrop"
          onClick={() => setAircoModalOpen(false)}
        >
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Remove airconditioner</h4>
            <p>Are you sure you want to remove this airconditioner?</p>

            <div className="wp-modal-actions">
              <button
                className="btn ghost-btn"
                type="button"
                onClick={() => setAircoModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn add-btn"
                type="button"
                onClick={confirmDeleteAirco}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
