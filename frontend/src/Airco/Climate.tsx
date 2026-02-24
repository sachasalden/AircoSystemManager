// Climate.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import './climate.css';

type WallpanelDevice = {
  id: string;
  name?: string;
  ip: string;
  version?: 'polarbear-v1' | 'polarbear-v2' | 'polarbear-v3';
  port: number;
  terminalIds: number[];
  zoneId?: string;
  roomId?: string;
  ids?: number[];
};

type Room = {
  id: string;
  name: string;
  aircopanels: WallpanelDevice[];
};

type Zone = {
  id: string;
  name: string;
  rooms: Room[];
};

function WallpanelCard({
  device,
  onRemove,
  onSave,
}: {
  device: WallpanelDevice;
  onRemove: () => void; // opens delete modal in parent
  onSave: (updated: {
    id: string;
    name?: string;
    ip: string;
    type?: WallpanelDevice['version'];
    port: number;
    ids: number[];
  }) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const initialIds =
    device.terminalIds?.length > 0 ? device.terminalIds : device.ids || [];

  // Local edit state
  const [editName, setEditName] = useState(device.name || '');
  const [editIp, setEditIp] = useState(device.ip);
  const [editType, setEditType] = useState<WallpanelDevice['version']>(
    device.version || 'polarbear-v1',
  );
  const [editPort, setEditPort] = useState<number | ''>(device.port);
  const [editNewTerminalId, setEditNewTerminalId] = useState<string>('');
  const [editTerminalIds, setEditTerminalIds] = useState<number[]>(initialIds);

  // Sync when device updates in parent
  useEffect(() => {
    const idsNow =
      device.terminalIds?.length > 0 ? device.terminalIds : device.ids || [];
    setEditName(device.name || '');
    setEditIp(device.ip);
    setEditType(device.version || 'polarbear-v1');
    setEditPort(device.port);
    setEditTerminalIds(idsNow);
    setEditNewTerminalId('');
  }, [device]);

  const terminalsText = initialIds.length ? initialIds.join(', ') : '—';

  function addEditTerminalId() {
    if (!editNewTerminalId) return;
    const parts = editNewTerminalId
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '');
    const idsToAdd = parts.map((p) => Number(p)).filter((n) => !Number.isNaN(n));
    if (idsToAdd.length === 0) {
      setEditNewTerminalId('');
      return;
    }

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
      device.terminalIds?.length > 0 ? device.terminalIds : device.ids || [];
    setIsEditing(false);
    setEditName(device.name || '');
    setEditIp(device.ip);
    setEditType(device.version || 'polarbear-v1');
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
                {device.ip}:{device.port} • {device.version || 'unknown'}
              </p>
            </div>
          </div>

          <div className="card-actions">
            {!isEditing ? (
              <button
                className="circle-btn"
                type="button"
                onClick={() => setIsEditing(true)}
                title="Edit"
              >
                Edit
              </button>
            ) : (
              <button
                className="circle-btn"
                type="button"
                onClick={cancelEdit}
                title="Cancel"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {!isEditing ? (
          <>
            <div className="big-temp">Wallpanel</div>
            <div className="current-row">
              <span style={{ opacity: 0.9 }}>🔌</span>
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
                    setEditType(e.target.value as WallpanelDevice['version'])
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
                  min={1}
                />
              </div>

              <div className="field span-2">
                <label className="field-label">Terminal IDs</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="text-input"
                    type="text"
                    value={editNewTerminalId}
                    onChange={(e) => setEditNewTerminalId(e.target.value)}
                    placeholder="e.g. 1,2,3"
                    style={{ flex: 1 }}
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
                      style={{ borderRadius: 999, padding: '8px 10px' }}
                      title="Remove terminal"
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

export default function Climate() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Modal state for deleting a wallpanel
  const [modalOpen, setModalOpen] = useState(false);
  const [panelToDelete, setPanelToDelete] = useState<string | null>(null);

  // Form state for adding a wallpanel
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [version, setVersion] =
    useState<WallpanelDevice['version']>('polarbear-v1');
  const [port, setPort] = useState<number | ''>(8000);
  const [newTerminalId, setNewTerminalId] = useState<string>('');
  const [terminalIds, setTerminalIds] = useState<number[]>([]);

  // Fetch zones/rooms/wallpanels tree
  useEffect(() => {
    async function fetchZones() {
      try {
        const res = await axios.get('http://localhost:3000/devices');
        setZones(res.data);
      } catch (err) {
        console.error('Failed to fetch zones', err);
      }
    }
    fetchZones();
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

  async function addWallpanel() {
    if (!selectedZoneId || !selectedRoomId) {
      window.alert('Select a zone and room first.');
      return;
    }
    if (!ip) return;

    // Check if the selected room already has a wallpanel
    const roomWithPanel = selectedZone?.rooms.find(
      (r) => r.id === selectedRoomId && r.aircopanels.length > 0,
    );
    if (roomWithPanel) {
      window.alert('This room already has a wallpanel. Only one wallpanel is allowed per room.');
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

      // Update local state
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
                        aircopanels: [
                          ...room.aircopanels,
                          {
                            ...res.data,
                            terminalIds: res.data.ids || [],
                            version: res.data.type || res.data.version,
                          },
                        ],
                      },
                ),
              },
        ),
      );

      resetForm();
    } catch (err) {
      console.error('Failed to add device', err);
    }
  }

  function addTerminalId() {
    if (!newTerminalId) return;
    const parts = newTerminalId
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '');
    const idsToAdd = parts.map((p) => Number(p)).filter((n) => !Number.isNaN(n));
    if (idsToAdd.length === 0) {
      setNewTerminalId('');
      return;
    }

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

  // Open modal (instead of window.confirm)
  function requestDeleteWallpanel(panelId: string) {
    setPanelToDelete(panelId);
    setModalOpen(true);
  }

  // Confirm delete from modal
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
    } finally {
      setModalOpen(false);
      setPanelToDelete(null);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setPanelToDelete(null);
  }

  async function updateWallpanel(updated: {
    id: string;
    name?: string;
    ip: string;
    type?: WallpanelDevice['version'];
    port: number;
    ids: number[];
  }) {
    if (!selectedZoneId || !selectedRoomId) return;

    try {
      const res = await axios.put(
        `http://localhost:3000/devices/${updated.id}`,
        updated,
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
                        aircopanels: room.aircopanels.map((p) =>
                          p.id !== updated.id
                            ? p
                            : {
                                ...p,
                                ...res.data,
                                terminalIds:
                                  res.data.ids || res.data.terminalIds || [],
                                ids: res.data.ids || res.data.terminalIds || [],
                                version:
                                  res.data.type ||
                                  res.data.version ||
                                  p.version,
                              },
                        ),
                      },
                ),
              },
        ),
      );
    } catch (err) {
      console.error('Failed to update device', err);
      window.alert('Failed to update device');
    }
  }

  return (
    <div className="climate-wrapper">
      <aside className="side-menu" aria-label="Zones">
        <h4>Zones</h4>
        {zones.map((zone) => (
          <button
            key={zone.id}
            className={`menu-item ${selectedZoneId === zone.id ? 'active' : ''}`}
            onClick={() => {
              setSelectedZoneId(zone.id);
              setSelectedRoomId(null);
            }}
          >
            {zone.name}
          </button>
        ))}
      </aside>

      <div className="climate-content">
        <div style={{ marginBottom: 24 }}>
          {selectedZone && (
            <>
              <h4>Rooms in {selectedZone.name}</h4>
              {selectedZone.rooms.map((room) => (
                <button
                  key={room.id}
                  className={`menu-item ${selectedRoomId === room.id ? 'active' : ''}`}
                  onClick={() => setSelectedRoomId(room.id)}
                  style={{ marginRight: 8, marginBottom: 8 }}
                >
                  {room.name}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="cards-grid">
          {selectedRoom ? (
            selectedRoom.aircopanels.length === 0 ? (
              <div className="climate-panel">
                <div className="empty">No wallpanels in this room</div>
              </div>
            ) : (
              selectedRoom.aircopanels.map((panel) => (
                <WallpanelCard
                  key={panel.id}
                  device={panel}
                  onRemove={() => requestDeleteWallpanel(panel.id)}
                  onSave={updateWallpanel}
                />
              ))
            )
          ) : (
            <div className="climate-panel">
              <div className="empty">
                {selectedZone
                  ? 'Select a room to see wallpanels'
                  : 'Select a zone to see rooms'}
              </div>
            </div>
          )}
        </div>

        {selectedZone && selectedRoom && (
          // Only show add form when the selected room has NO wallpanel yet
          (selectedRoom.aircopanels?.length || 0) === 0 ? (
            <main className="climate-panel">
              <h5 className="climate-title">Wallpanel — Add device</h5>
              <div className="climate-form">
                <div className="field span-2">
                  <label className="field-label">Name</label>
                  <input
                    className="text-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Hall Wallpanel"
                  />
                </div>

                <div className="field span-2">
                  <label className="field-label">IP Address</label>
                  <input
                    className="text-input"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="192.168.xx.xx"
                  />
                </div>

                <div className="field">
                  <label className="field-label">Polarbear Version</label>
                  <select
                    className="browser-default"
                    value={version}
                    onChange={(e) =>
                      setVersion(e.target.value as WallpanelDevice['version'])
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
                      setPort(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    min={1}
                  />
                </div>

                <div className="field span-2">
                  <label className="field-label">Terminal IDs</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="text-input"
                      type="text"
                      value={newTerminalId}
                      onChange={(e) => setNewTerminalId(e.target.value)}
                      placeholder="e.g. 1,2,3"
                      style={{ flex: 1 }}
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
                        style={{ borderRadius: 999, padding: '8px 10px' }}
                        title="Remove terminal"
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
            <main className="climate-panel">
              <h5 className="climate-title">Wallpanel — Add device</h5>
              <div>
                <p className="notice">This room already has a wallpanel. Only one wallpanel is allowed per room.</p>
                <p className="notice">If you want to manage terminals for the existing wallpanel, edit the wallpanel from the card above.</p>
              </div>
            </main>
          )
        )}
      </div>

      {/* Custom delete modal */}
      {modalOpen && (
        <div
          className="wp-modal-backdrop"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="wp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="delete-modal-title">Remove wallpanel</h4>
            <p>Are you sure you want to remove this wallpanel?</p>

            <div className="wp-modal-actions">
              <button
                className="btn ghost-btn"
                type="button"
                onClick={closeModal}
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
    </div>
  );
}
