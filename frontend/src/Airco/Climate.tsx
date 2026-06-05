import { useEffect, useState } from 'react';
import axios from 'axios';
import AircoInsights from './AircoInsights';
import WallpanelInsights from './WallpanelInsights';
import { API_BASE } from './api';
import './climate.css';
import AirconditionerCard from './components/AirconditionerCard';
import AirconditionerForm from './components/AirconditionerForm';
import ConfirmModal from './components/ConfirmModal';
import EnvironmentDeviceCard from './components/EnvironmentDeviceCard';
import EnvironmentDeviceForm from './components/EnvironmentDeviceForm';
import WallpanelCard from './components/WallpanelCard';
import WallpanelForm from './components/WallpanelForm';
import {
  getAircoDeviceDefaults,
  normalizeAirconditionerDevice,
  normalizeEnvironmentDevice,
  normalizeWallpanelDevice,
  normalizeZones,
  type AirconditionerDevice,
  type EnvironmentDevice,
  type Room,
  type WallpanelVersion,
  type Zone,
} from './model';

export default function Climate() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [environmentDevices, setEnvironmentDevices] = useState<
    EnvironmentDevice[]
  >([]);
  const [supportedEnvironmentDeviceTypes, setSupportedEnvironmentDeviceTypes] =
    useState<string[]>([]);

  const [activeView, setActiveView] = useState<
    'zones' | 'aircoSystemDevices' | 'wallpanelInsights' | 'aircoInsights'
  >('zones');

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [panelToDelete, setPanelToDelete] = useState<string | null>(null);

  const [aircoModalOpen, setAircoModalOpen] = useState(false);
  const [aircoToDelete, setAircoToDelete] = useState<string | null>(null);

  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<string | null>(null);

  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  const [showWallpanelForm, setShowWallpanelForm] = useState(false);
  const [showAircoForm, setShowAircoForm] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [zonesRes, environmentDevicesRes, adapterTypesRes] =
          await Promise.all([
            axios.get(`${API_BASE}/devices`),
            axios.get(`${API_BASE}/environment-devices`),
            axios.get(`${API_BASE}/airco-adapter-types`),
          ]);

        const rawEnvironmentDevices = Array.isArray(environmentDevicesRes.data)
          ? environmentDevicesRes.data
          : [];
        const rawAdapterTypes = Array.isArray(adapterTypesRes.data)
          ? adapterTypesRes.data
          : [];

        const normalizedEnvironmentDevices = rawEnvironmentDevices.map(
          (device: Partial<EnvironmentDevice>) =>
            normalizeEnvironmentDevice(device),
        );

        setZones(normalizeZones(zonesRes.data));
        setEnvironmentDevices(normalizedEnvironmentDevices);
        setSupportedEnvironmentDeviceTypes(
          rawAdapterTypes
            .map((entry: { type?: string }) => String(entry.type ?? '').trim())
            .filter((type: string) => type.length > 0),
        );
      } catch (err) {
        console.error('Failed to fetch climate data', err);
      }
    }

    fetchData();
  }, []);

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
  const selectedRoom = selectedZone?.rooms.find(
    (room) => room.id === selectedRoomId,
  );
  const compatibleEnvironmentDevices = environmentDevices.filter((device) =>
    supportedEnvironmentDeviceTypes.includes(device.type),
  );

  async function addZone() {
    const name = window.prompt('Zone name', 'New zone')?.trim();

    if (!name) {
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/zones`, { name });
      const [zone] = normalizeZones([res.data]);

      setZones((prev) => [...prev, zone]);
      setActiveView('zones');
      setSelectedZoneId(zone.id);
      setSelectedRoomId(null);
    } catch (err) {
      console.error('Failed to add zone', err);
      window.alert('Failed to add zone');
    }
  }

  async function confirmDeleteZone() {
    if (!zoneToDelete) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/zones/${zoneToDelete}`);

      setZones((prev) => prev.filter((zone) => zone.id !== zoneToDelete));

      if (selectedZoneId === zoneToDelete) {
        setSelectedZoneId(null);
        setSelectedRoomId(null);
      }
    } catch (err) {
      console.error('Failed to delete zone', err);
      window.alert('Failed to delete zone');
    } finally {
      setZoneModalOpen(false);
      setZoneToDelete(null);
    }
  }

  async function addRoom() {
    if (!selectedZoneId) {
      window.alert('Select a zone first.');
      return;
    }

    const name = window.prompt('Room name', 'New room')?.trim();

    if (!name) {
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/zones/${selectedZoneId}/rooms`, {
        name,
      });
      const room: Room = {
        id: String(res.data.id ?? ''),
        name: String(res.data.name ?? name),
        aircopanels: [],
        airconditioners: [],
      };

      setZones((prevZones) =>
        prevZones.map((zone) =>
          zone.id !== selectedZoneId
            ? zone
            : {
                ...zone,
                rooms: [...zone.rooms, room],
              },
        ),
      );
      setSelectedRoomId(room.id);
    } catch (err) {
      console.error('Failed to add room', err);
      window.alert('Failed to add room');
    }
  }

  async function confirmDeleteRoom() {
    if (!selectedZoneId || !roomToDelete) {
      return;
    }

    try {
      await axios.delete(
        `${API_BASE}/zones/${selectedZoneId}/rooms/${roomToDelete}`,
      );

      setZones((prevZones) =>
        prevZones.map((zone) =>
          zone.id !== selectedZoneId
            ? zone
            : {
                ...zone,
                rooms: zone.rooms.filter((room) => room.id !== roomToDelete),
              },
        ),
      );

      if (selectedRoomId === roomToDelete) {
        setSelectedRoomId(null);
      }
    } catch (err) {
      console.error('Failed to delete room', err);
      window.alert('Failed to delete room');
    } finally {
      setRoomModalOpen(false);
      setRoomToDelete(null);
    }
  }

  async function addEnvironmentDevice(value: {
    name: string;
    type: string;
    ip: string;
    port: string;
    bidirectional: boolean;
  }) {
    if (!value.name || !value.type || !value.ip || !value.port) {
      window.alert('Name, type, ip en port zijn verplicht.');
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE}/environment-devices`,
        {
          name: value.name,
          type: value.type,
          ip: value.ip,
          port: value.port,
          bidirectional: value.bidirectional,
        },
      );

      const normalizedDevice = normalizeEnvironmentDevice(res.data);

      setEnvironmentDevices((prev) => [...prev, normalizedDevice]);
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
      await axios.delete(`${API_BASE}/environment-devices/${id}`);

      const remaining = environmentDevices.filter((device) => device.id !== id);
      setEnvironmentDevices(remaining);
    } catch (err) {
      console.error('Failed to delete environment device', err);
      window.alert('Failed to delete environment device');
    }
  }

  async function addWallpanel(value: {
    name: string;
    ip: string;
    port: number | '';
    modbusUnits: {
      id: number;
      type: WallpanelVersion;
    }[];
  }) {
    if (!selectedZoneId || !selectedRoomId) {
      window.alert('Select a zone and room first.');
      return;
    }

    if (!value.ip) {
      window.alert('IP Address is required.');
      return;
    }

    const roomWithPanel = selectedZone?.rooms.find(
      (room) => room.id === selectedRoomId && room.aircopanels.length > 0,
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
      name: value.name,
      ip: value.ip,
      type: 'moxa',
      port: value.port === '' ? 0 : Number(value.port),
      ids: value.modbusUnits.map((unit) => unit.id),
      modbusUnits: value.modbusUnits,
    };

    try {
      const res = await axios.post(`${API_BASE}/devices`, device);
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
      setShowWallpanelForm(false);
    } catch (err) {
      console.error('Failed to add device', err);
      window.alert('Failed to add wallpanel');
    }
  }

  async function addAirconditioner(value: {
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
    if (!selectedZoneId || !selectedRoomId) {
      window.alert('Select a zone and room first.');
      return;
    }

    const selectedEnvDevice = environmentDevices.find(
      (device) => device.id === value.selectedEnvironmentDeviceId,
    );

    if (!selectedEnvDevice || !value.deviceType || !value.terminalId) {
      window.alert(
        'Environment device, device model en terminal id zijn verplicht.',
      );
      return;
    }

    const defaults = getAircoDeviceDefaults(value.deviceType);

    const device = {
      zoneId: selectedZoneId,
      roomId: selectedRoomId,
      name: value.name,
      deviceType: value.deviceType,
      minTemperature:
        value.minTemperature === '' ? undefined : Number(value.minTemperature),
      maxTemperature:
        value.maxTemperature === '' ? undefined : Number(value.maxTemperature),
      minSetTemperature:
        value.minSetTemperature === ''
          ? undefined
          : Number(value.minSetTemperature),
      maxSetTemperature:
        value.maxSetTemperature === ''
          ? undefined
          : Number(value.maxSetTemperature),
      setTemperature:
        value.minSetTemperature === ''
          ? defaults.setTemperature
          : Number(value.minSetTemperature),
      currentTemperature: -1,
      currentFanspeed: -1,
      minFanspeed:
        value.minFanspeed === '' ? undefined : Number(value.minFanspeed),
      maxFanspeed:
        value.maxFanspeed === '' ? undefined : Number(value.maxFanspeed),
      minFanMode:
        value.minFanMode === '' ? undefined : Number(value.minFanMode),
      maxFanMode:
        value.maxFanMode === '' ? undefined : Number(value.maxFanMode),
      data: {
        deviceId: selectedEnvDevice.id,
        type: selectedEnvDevice.type,
        deviceTerminalId: value.terminalId,
        roomTemparatureAddress: value.roomTemparatureAddress,
        roomTemparatureSetPointAddress: value.roomTemparatureSetPointAddress,
        fanspeedAddress: value.fanspeedAddress,
        fanspeedSetPointAddress: value.fanspeedSetPointAddress,
      },
    };

    try {
      const res = await axios.post(
        `${API_BASE}/airco-devices`,
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

      setShowAircoForm(false);
    } catch (err) {
      console.error('Failed to add airconditioner', err);
      window.alert('Failed to add airconditioner');
    }
  }

  async function updateWallpanel(updated: {
    id: string;
    name?: string;
    ip: string;
    type?: string;
    port: number;
    ids: number[];
    modbusUnits: {
      id: number;
      type: WallpanelVersion;
    }[];
  }) {
    if (!selectedZoneId || !selectedRoomId) return;

    try {
      const res = await axios.put(
        `${API_BASE}/devices/${updated.id}`,
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
                        aircopanels: room.aircopanels.map((panel) =>
                          panel.id !== updated.id ? panel : normalizedPanel,
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
        `${API_BASE}/airco-devices/${updated.id}`,
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
                        airconditioners: room.airconditioners.map((airco) =>
                          airco.id !== updated.id ? airco : normalizedAirco,
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
      await axios.delete(`${API_BASE}/devices/${panelToDelete}`);

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
                          (panel) => panel.id !== panelToDelete,
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
        `${API_BASE}/airco-devices/${aircoToDelete}`,
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
                          (airco) => airco.id !== aircoToDelete,
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
          className={`menu-item ${activeView === 'aircoSystemDevices' ? 'active' : ''}`}
          onClick={() => {
            setActiveView('aircoSystemDevices');
            setSelectedZoneId(null);
            setSelectedRoomId(null);
            setShowWallpanelForm(false);
            setShowAircoForm(false);
          }}
        >
          Airco system devices
        </button>

        <button
          className={`menu-item ${activeView === 'wallpanelInsights' ? 'active' : ''}`}
          onClick={() => {
            setActiveView('wallpanelInsights');
            setShowWallpanelForm(false);
            setShowAircoForm(false);
          }}
        >
          Wallpanel insights
        </button>

        <button
          className={`menu-item ${activeView === 'aircoInsights' ? 'active' : ''}`}
          onClick={() => {
            setActiveView('aircoInsights');
            setShowWallpanelForm(false);
            setShowAircoForm(false);
          }}
        >
          Airco insights
        </button>

        <div className="side-section-title">
          <div>
            <h4>Zones</h4>
            <p>Manage climate areas</p>
          </div>
          <button className="zone-add-btn" type="button" onClick={addZone}>
            New zone
          </button>
        </div>

        {zones.map((zone) => (
          <div className="zone-menu-row" key={zone.id}>
            <button
              className={`menu-item ${
                activeView === 'zones' && selectedZoneId === zone.id
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                setActiveView('zones');
                setSelectedZoneId(zone.id);
                setSelectedRoomId(null);
                setShowWallpanelForm(false);
                setShowAircoForm(false);
              }}
            >
              {zone.name}
            </button>
            <button
              className="zone-remove-btn"
              type="button"
              onClick={() => {
                setZoneToDelete(zone.id);
                setZoneModalOpen(true);
              }}
              aria-label={`Remove zone ${zone.name}`}
            >
              Remove
            </button>
          </div>
        ))}
      </aside>

      <div className="climate-content">
        {activeView === 'aircoSystemDevices' ? (
          <main className="climate-panel">
            <h5 className="climate-title">Airco system devices</h5>

            <EnvironmentDeviceForm
              availableTypes={supportedEnvironmentDeviceTypes}
              onSubmit={addEnvironmentDevice}
            />

            <div className="cards-grid" style={{ marginTop: 24 }}>
              {compatibleEnvironmentDevices.length === 0 ? (
                <div className="empty">No airco system devices yet</div>
              ) : (
                compatibleEnvironmentDevices.map((device) => (
                  <EnvironmentDeviceCard
                    key={device.id}
                    device={device}
                    onRemove={() => deleteEnvironmentDevice(device.id)}
                  />
                ))
              )}
            </div>
          </main>
        ) : activeView === 'wallpanelInsights' ? (
          <WallpanelInsights
            zones={zones}
            selectedZoneId={selectedZoneId}
            selectedRoomId={selectedRoomId}
            setSelectedZoneId={setSelectedZoneId}
            setSelectedRoomId={setSelectedRoomId}
          />
        ) : activeView === 'aircoInsights' ? (
          <AircoInsights
            zones={zones}
            selectedZoneId={selectedZoneId}
            selectedRoomId={selectedRoomId}
            setSelectedZoneId={setSelectedZoneId}
            setSelectedRoomId={setSelectedRoomId}
          />
        ) : (
          <>
            <div className="room-selector">
              {selectedZone && (
                <>
                  <div className="room-selector-header">
                    <h4 className="room-selector-title">
                      Rooms in {selectedZone.name}
                    </h4>
                    <button
                      type="button"
                      className="room-add-btn"
                      onClick={addRoom}
                    >
                      New room
                    </button>
                  </div>
                  <div className="room-selector-list">
                    {selectedZone.rooms.map((room) => (
                      <div className="room-chip-wrap" key={room.id}>
                        <button
                          className={`room-chip ${
                            selectedRoomId === room.id ? 'active' : ''
                          }`}
                          onClick={() => {
                            setSelectedRoomId(room.id);
                            setShowWallpanelForm(false);
                            setShowAircoForm(false);
                          }}
                          type="button"
                        >
                          {room.name}
                        </button>
                        <button
                          className="room-remove-btn"
                          type="button"
                          onClick={() => {
                            setSelectedRoomId(room.id);
                            setRoomToDelete(room.id);
                            setRoomModalOpen(true);
                          }}
                          aria-label={`Remove room ${room.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {selectedZone.rooms.length === 0 && (
                      <div className="empty">No rooms in this zone yet</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {selectedRoom ? (
              <>
                <div
                  style={{
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <h4 style={{ margin: 0 }}>Wallpanels</h4>
                  {selectedRoom.aircopanels.length === 0 && (
                    <button
                      type="button"
                      className="btn add-btn"
                      onClick={() => setShowWallpanelForm((state) => !state)}
                    >
                      {showWallpanelForm ? 'Close' : 'New wallpanel'}
                    </button>
                  )}
                </div>

                {showWallpanelForm && selectedRoom.aircopanels.length === 0 && (
                  <main className="climate-panel" style={{ marginBottom: 24 }}>
                    <h5 className="climate-title">Wallpanel - Add device</h5>

                    <WallpanelForm
                      onSubmit={addWallpanel}
                      onCancel={() => {
                        setShowWallpanelForm(false);
                      }}
                    />
                  </main>
                )}

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
                    onClick={() => setShowAircoForm((state) => !state)}
                  >
                    {showAircoForm ? 'Close' : 'New AC'}
                  </button>
                </div>

                {showAircoForm && (
                  <main className="climate-panel" style={{ marginBottom: 24 }}>
                    <h5 className="climate-title">
                      Airconditioning - Add device
                    </h5>

                    <AirconditionerForm
                      environmentDevices={environmentDevices}
                      supportedEnvironmentDeviceTypes={
                        supportedEnvironmentDeviceTypes
                      }
                      onSubmit={addAirconditioner}
                      onCancel={() => {
                        setShowAircoForm(false);
                      }}
                    />
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
                        supportedEnvironmentDeviceTypes={
                          supportedEnvironmentDeviceTypes
                        }
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
          </>
        )}
      </div>

      <ConfirmModal
        title="Remove wallpanel"
        message="Are you sure you want to remove this wallpanel?"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onConfirm={confirmDeleteWallpanel}
      />

      <ConfirmModal
        title="Remove airconditioner"
        message="Are you sure you want to remove this airconditioner?"
        open={aircoModalOpen}
        onCancel={() => setAircoModalOpen(false)}
        onConfirm={confirmDeleteAirco}
      />

      <ConfirmModal
        title="Remove zone"
        message="Are you sure you want to remove this zone? All rooms and devices inside it will also be removed."
        open={zoneModalOpen}
        onCancel={() => setZoneModalOpen(false)}
        onConfirm={confirmDeleteZone}
      />

      <ConfirmModal
        title="Remove room"
        message="Are you sure you want to remove this room? Devices inside this room will also be removed."
        open={roomModalOpen}
        onCancel={() => setRoomModalOpen(false)}
        onConfirm={confirmDeleteRoom}
      />
    </div>
  );
}
