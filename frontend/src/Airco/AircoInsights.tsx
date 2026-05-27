import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { SelectInput } from './components/ClimateFormControls';
import SemiCircularTemperatureSlider from './components/SemiCircularTemperatureSlider';
import { GENERIC_AIRCO_DEFAULTS, type AirconditionerDevice } from './model';
import type {
  AircoInsight,
  AircoInsightsProps,
  AircoInsightsResponse,
  AircoInsightZone,
} from './airco-insights/model';

const API_BASE = 'http://localhost:3000';

type CommandProperty = 'setpoint' | 'fanSpeed' | 'fanMode';
type CommandOverrides = Record<string, number>;

function formatNumber(value: number | undefined, fallback = '-'): string {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function commandOverrideKey(
  aircoId: string,
  zone: 1 | 2,
  property: CommandProperty,
): string {
  return `${aircoId}:${zone}:${property}`;
}

function applyCommandOverrides(
  nextData: AircoInsightsResponse,
  overrides: CommandOverrides,
): AircoInsightsResponse {
  if (Object.keys(overrides).length === 0) {
    return nextData;
  }

  return {
    ...nextData,
    aircos: nextData.aircos.map((airco) => ({
      ...airco,
      zones: airco.zones.map((zoneState) => ({
        ...zoneState,
        setpoint:
          overrides[
            commandOverrideKey(airco.aircoId, zoneState.zone, 'setpoint')
          ] ?? zoneState.setpoint,
        fanSpeed:
          overrides[
            commandOverrideKey(airco.aircoId, zoneState.zone, 'fanSpeed')
          ] ?? zoneState.fanSpeed,
        fanMode:
          overrides[
            commandOverrideKey(airco.aircoId, zoneState.zone, 'fanMode')
          ] ?? zoneState.fanMode,
      })),
    })),
  };
}

export default function AircoInsights({
  zones,
  selectedZoneId,
  selectedRoomId,
  setSelectedZoneId,
  setSelectedRoomId,
}: AircoInsightsProps) {
  const [data, setData] = useState<AircoInsightsResponse | null>(null);
  const [selectedAircoId, setSelectedAircoId] = useState('');
  const [selectedControlZone, setSelectedControlZone] = useState<1 | 2>(1);
  const [draftSetpoint, setDraftSetpoint] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const commandOverridesRef = useRef<CommandOverrides>({});

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId);

  const selectedRoom = selectedZone?.rooms.find(
    (room) => room.id === selectedRoomId,
  );

  const roomAircos = selectedRoom?.airconditioners ?? [];

  const selectedAirco =
    roomAircos.find((airco) => airco.id === selectedAircoId) ?? roomAircos[0];

  const selectedInsight = data?.aircos.find(
    (airco) => airco.aircoId === selectedAirco?.id,
  );

  const selectedZoneInsight = selectedInsight?.zones.find(
    (zone) => zone.zone === selectedControlZone,
  );

  const minSetpoint =
    selectedAirco?.minSetTemperature ??
    GENERIC_AIRCO_DEFAULTS.minSetTemperature;
  const maxSetpoint =
    selectedAirco?.maxSetTemperature ??
    GENERIC_AIRCO_DEFAULTS.maxSetTemperature;
  const minFanSpeed =
    selectedAirco?.minFanspeed ?? GENERIC_AIRCO_DEFAULTS.minFanspeed;
  const maxFanSpeed =
    selectedAirco?.maxFanspeed ?? GENERIC_AIRCO_DEFAULTS.maxFanspeed;
  const minFanMode =
    selectedAirco?.minFanMode ?? GENERIC_AIRCO_DEFAULTS.minFanMode;
  const maxFanMode =
    selectedAirco?.maxFanMode ?? GENERIC_AIRCO_DEFAULTS.maxFanMode;
  const fanModes = Array.from(
    { length: Math.max(0, maxFanMode - minFanMode + 1) },
    (_, index) => minFanMode + index,
  );

  const activeSetpoint =
    draftSetpoint ??
    selectedZoneInsight?.setpoint ??
    selectedAirco?.setTemperature ??
    minSetpoint;

  const virtualTemperature = selectedZoneInsight?.virtualTemperature;

  async function fetchInsights() {
    if (!selectedZoneId || !selectedRoomId) return;

    try {
      setLoading(true);
      setError('');

      const res = await axios.get<AircoInsightsResponse>(
        `${API_BASE}/airco-insights/rooms/${selectedZoneId}/${selectedRoomId}`,
      );

      setData(applyCommandOverrides(res.data, commandOverridesRef.current));
    } catch (err) {
      console.error('Failed to fetch airco insights', err);
      setError('Failed to fetch airco insights');
    } finally {
      setLoading(false);
    }
  }

  function updateLocalInsight(
    current: AircoInsightsResponse | null,
    aircoId: string,
    zone: 1 | 2,
    property: CommandProperty,
    value: number,
  ): AircoInsightsResponse | null {
    if (!current) return current;

    return {
      ...current,
      aircos: current.aircos.map((airco) =>
        airco.aircoId !== aircoId
          ? airco
          : {
              ...airco,
              zones: airco.zones.map((zoneState) =>
                zoneState.zone !== zone
                  ? zoneState
                  : {
                      ...zoneState,
                      status: 'ok',
                      [property]: value,
                    },
              ),
            },
      ),
    };
  }

  async function sendCommand(
    airco: AirconditionerDevice,
    property: CommandProperty,
    value: number,
  ) {
    if (!selectedZoneId || !selectedRoomId) return;

    try {
      setSaving(true);
      setError('');

      await axios.post(
        `${API_BASE}/airco-insights/rooms/${selectedZoneId}/${selectedRoomId}/aircos/${airco.id}/commands`,
        {
          property,
          zone: selectedControlZone,
          value,
        },
      );

      commandOverridesRef.current = {
        ...commandOverridesRef.current,
        [commandOverrideKey(airco.id, selectedControlZone, property)]: value,
      };

      setData((current) =>
        updateLocalInsight(
          current,
          airco.id,
          selectedControlZone,
          property,
          value,
        ),
      );
    } catch (err) {
      console.error('Failed to apply airco command', err);
      setError('Failed to apply airco command');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    setData(null);
    setError('');
    setDraftSetpoint(null);
    commandOverridesRef.current = {};

    if (selectedZoneId && selectedRoomId) {
      void fetchInsights();
    }
  }, [selectedZoneId, selectedRoomId]);

  useEffect(() => {
    if (!selectedAircoId && roomAircos[0]) {
      setSelectedAircoId(roomAircos[0].id);
    }

    if (
      selectedAircoId &&
      !roomAircos.some((airco) => airco.id === selectedAircoId)
    ) {
      setSelectedAircoId(roomAircos[0]?.id ?? '');
    }
  }, [roomAircos, selectedAircoId]);

  useEffect(() => {
    setDraftSetpoint(null);
  }, [selectedAircoId, selectedControlZone, selectedZoneInsight?.setpoint]);

  useEffect(() => {
    if (!selectedZoneId || !selectedRoomId) {
      return;
    }

    setLoading(true);

    const streamUrl = `${API_BASE}/airco-insights/stream/rooms/${selectedZoneId}/${selectedRoomId}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('insights', (event) => {
      try {
        const nextData = JSON.parse(
          (event as MessageEvent).data,
        ) as AircoInsightsResponse;

        setData(applyCommandOverrides(nextData, commandOverridesRef.current));
        setError('');
        setLoading(false);
      } catch (streamError) {
        console.error(
          'Failed to parse airco insights stream payload',
          streamError,
        );
      }
    });

    eventSource.addEventListener('insights-error', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          message?: string;
        };

        setError(payload.message || 'Failed to stream airco insights');
      } catch {
        setError('Failed to stream airco insights');
      }

      setLoading(false);
    });

    eventSource.onerror = () => {
      setLoading(false);
    };

    return () => {
      eventSource.close();
    };
  }, [selectedZoneId, selectedRoomId]);

  return (
    <main className="climate-panel airco-console">
      <div className="airco-console-header">
        <div>
          <h5 className="climate-title">Airco insights</h5>
          <p className="notice">
            Live airco-data en bediening voor de gekozen room.
          </p>
        </div>

        <p className="notice airco-live-status">
          {loading
            ? 'Connecting...'
            : saving
              ? 'Sending command...'
              : 'Live via server events'}
        </p>
      </div>

      <div className="airco-console-filters">
        <label className="field">
          <span className="field-label">Zone</span>
          <SelectInput
            value={selectedZoneId ?? ''}
            onChange={(zoneId) => {
              setSelectedZoneId(zoneId || null);
              setSelectedRoomId(null);
              setSelectedAircoId('');
            }}
          >
            <option value="">Select zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </SelectInput>
        </label>

        <label className="field">
          <span className="field-label">Room</span>
          <SelectInput
            value={selectedRoomId ?? ''}
            onChange={(roomId) => {
              setSelectedRoomId(roomId || null);
              setSelectedAircoId('');
            }}
            disabled={!selectedZone}
          >
            <option value="">Select room</option>
            {selectedZone?.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </SelectInput>
        </label>

        <label className="field">
          <span className="field-label">Airco device</span>
          <SelectInput
            value={selectedAirco?.id ?? ''}
            onChange={(aircoId) => setSelectedAircoId(aircoId)}
            disabled={roomAircos.length === 0}
          >
            {roomAircos.length === 0 ? (
              <option value="">No airco devices</option>
            ) : (
              roomAircos.map((airco) => (
                <option key={airco.id} value={airco.id}>
                  {airco.name || 'Airconditioning'} - {airco.deviceType}
                </option>
              ))
            )}
          </SelectInput>
        </label>

        <label className="field">
          <span className="field-label">Control zone</span>
          <SelectInput
            value={String(selectedControlZone)}
            onChange={(value) => setSelectedControlZone(Number(value) as 1 | 2)}
            disabled={!selectedAirco}
          >
            <option value="1">Zone 1</option>
            <option value="2">Zone 2</option>
          </SelectInput>
        </label>
      </div>

      {!selectedZone || !selectedRoom ? (
        <div className="empty">Select a zone and room first</div>
      ) : !selectedAirco ? (
        <div className="empty">No airco devices in this room</div>
      ) : error ? (
        <div className="empty">{error}</div>
      ) : (
        <div className="airco-console-grid">
          <section className="airco-thermostat-card">
            <div className="airco-device-title">
              <div>
                <p className="stat-label">Selected airco</p>
                <h4>{selectedAirco.name || 'Airconditioning'}</h4>
              </div>

              <span>{selectedAirco.data.type}</span>
            </div>

            <SemiCircularTemperatureSlider
              value={activeSetpoint}
              min={minSetpoint}
              max={maxSetpoint}
              step={0.5}
              virtualTemperature={virtualTemperature}
              zone={selectedControlZone}
              disabled={saving}
              onChange={(value) => setDraftSetpoint(value)}
            />

            <button
              className="btn add-btn airco-apply-btn"
              type="button"
              disabled={saving || draftSetpoint === null}
              onClick={() => {
                if (draftSetpoint !== null) {
                  void sendCommand(selectedAirco, 'setpoint', draftSetpoint);
                  setDraftSetpoint(null);
                }
              }}
            >
              {saving ? 'Applying...' : 'Apply setpoint'}
            </button>
          </section>

          <section className="airco-controls-card">
            <AircoStatusPanel
              insight={selectedInsight}
              zoneState={selectedZoneInsight}
            />

            <div className="airco-control-block">
              <div>
                <p className="stat-label">Fan speed</p>
                <h4>{formatNumber(selectedZoneInsight?.fanSpeed)}</h4>
              </div>

              <div className="fan-speed-buttons">
                {Array.from(
                  { length: maxFanSpeed - minFanSpeed + 1 },
                  (_, index) => minFanSpeed + index,
                ).map((speed) => (
                  <button
                    key={speed}
                    className={`fan-chip ${
                      selectedZoneInsight?.fanSpeed === speed ? 'active' : ''
                    }`}
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void sendCommand(selectedAirco, 'fanSpeed', speed)
                    }
                  >
                    {speed}
                  </button>
                ))}
              </div>
            </div>

            <div className="airco-control-block">
              <div>
                <p className="stat-label">Fan mode</p>
                <h4>{formatNumber(selectedZoneInsight?.fanMode)}</h4>
              </div>

              <div className="fan-mode-grid">
                {fanModes.map((value) => (
                  <button
                    key={value}
                    className={`mode-card ${
                      selectedZoneInsight?.fanMode === value ? 'active' : ''
                    }`}
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void sendCommand(selectedAirco, 'fanMode', value)
                    }
                  >
                    <span>{formatFanModeLabel(value)}</span>
                    <strong>{value}</strong>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function formatFanModeLabel(value: number): string {
  if (value === 0) return 'Off';
  if (value === 1) return 'Auto';
  return `Mode ${value}`;
}

function AircoStatusPanel({
  insight,
  zoneState,
}: {
  insight?: AircoInsight;
  zoneState?: AircoInsightZone;
}) {
  return (
    <div className="airco-live-strip">
      <div>
        <p className="stat-label">Unit</p>
        <strong>{insight?.unitId ?? '-'}</strong>
      </div>

      <div>
        <p className="stat-label">Setpoint</p>
        <strong>{formatNumber(zoneState?.setpoint)}°</strong>
      </div>

      <div>
        <p className="stat-label">Updated</p>
        <strong>
          {zoneState?.updatedAt
            ? new Date(zoneState.updatedAt).toLocaleTimeString()
            : '-'}
        </strong>
      </div>

      <div>
        <p className="stat-label">Status</p>
        <strong>{zoneState?.status ?? 'waiting'}</strong>
      </div>
    </div>
  );
}
