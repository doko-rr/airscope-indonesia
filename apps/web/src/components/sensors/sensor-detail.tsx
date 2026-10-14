'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SensorHistoryChart } from '@/components/charts/sensor-history-chart';
import { formatRelativeDuration } from '@/lib/formatters';
import type {
  SensorEvent,
  SensorEventSeverity,
  StationWithMeasurement,
} from '@/types/sensor';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; item: StationWithMeasurement };

type DetailTab = 'overview' | 'events' | 'settings';
type EventFilter = 'ALL' | SensorEventSeverity;

type EventState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: SensorEvent[] };

type EventAction = 'acknowledge' | 'resolve';
type MutationState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string };

function unwrap<T>(payload: T | { data: T }): T {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!response.ok)
    throw new Error(`API request failed with HTTP ${response.status}`);
  return unwrap<T>((await response.json()) as T | { data: T });
}

async function mutateEvent(
  eventId: string,
  action: EventAction,
  payload: { operator: string; note?: string },
): Promise<SensorEvent> {
  const response = await fetch(
    `${API_URL}/events/${encodeURIComponent(eventId)}/${action}`,
    {
      method: 'PATCH',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new Error(
      message ?? `Event action failed with HTTP ${response.status}`,
    );
  }

  return unwrap<SensorEvent>(
    (await response.json()) as SensorEvent | { data: SensorEvent },
  );
}

async function loadStation(code: string): Promise<StationWithMeasurement> {
  const stations =
    await getJson<
      Array<StationWithMeasurement['station'] | StationWithMeasurement>
    >('/sensors');
  const found = stations.find((entry) =>
    'station' in entry ? entry.station.code === code : entry.code === code,
  );
  if (!found) throw new Error(`Station ${code} was not found.`);
  if ('latest' in found) return found;
  const latest = await getJson<StationWithMeasurement['latest']>(
    `/sensors/${code}/latest`,
  );
  return { station: found, latest };
}

function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: 'green' | 'amber';
}) {
  return (
    <article
      className={
        accent ? `sensor-detail-metric is-${accent}` : 'sensor-detail-metric'
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </article>
  );
}

export function SensorDetail() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = decodeURIComponent(params.code ?? '');
  const requestedTab = searchParams.get('tab');
  const activeTab: DetailTab =
    requestedTab === 'events' || requestedTab === 'settings'
      ? requestedTab
      : 'overview';
  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [eventFilter, setEventFilter] = useState<EventFilter>('ALL');
  const [eventState, setEventState] = useState<EventState>({ status: 'idle' });
  const [eventRevision, setEventRevision] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventAction, setEventAction] = useState<EventAction | null>(null);
  const [operator, setOperator] = useState('');
  const [note, setNote] = useState('');
  const [mutationState, setMutationState] = useState<MutationState>({
    status: 'idle',
  });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadStation(code)
      .then((item) => active && setState({ status: 'ready', item }))
      .catch(
        (error: unknown) =>
          active &&
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Station could not be loaded.',
          }),
      );
    return () => {
      active = false;
    };
  }, [code, refreshRevision]);

  useEffect(() => {
    let active = true;
    setEventState({ status: 'loading' });

    getJson<SensorEvent[]>(`/sensors/${encodeURIComponent(code)}/events`)
      .then((events) => {
        if (active) setEventState({ status: 'ready', events });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setEventState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Event Log could not be loaded.',
        });
      });

    return () => {
      active = false;
    };
  }, [code, eventRevision, refreshRevision]);

  if (state.status === 'loading') {
    return (
      <div className="sensor-detail-state">
        <strong>Loading station record</strong>
        <span>{code}</span>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="sensor-detail-state is-error">
        <strong>Station record unavailable</strong>
        <span>{state.message}</span>
        <Link href="/sensors">← Back to sensor directory</Link>
      </div>
    );
  }

  const { station, latest } = state.item;
  const status = station.status === 'WARNING' ? 'ADVISORY' : station.status;
  const advisory = status === 'ADVISORY';
  const events = eventState.status === 'ready' ? eventState.events : [];
  const visibleEvents =
    eventFilter === 'ALL'
      ? events
      : events.filter((event) => event.severity === eventFilter);

  function openEventAction(eventId: string, action: EventAction) {
    setSelectedEventId(eventId);
    setEventAction(action);
    setOperator('');
    setNote('');
    setMutationState({ status: 'idle' });
  }

  function closeEventAction() {
    setSelectedEventId(null);
    setEventAction(null);
    setOperator('');
    setNote('');
    setMutationState({ status: 'idle' });
  }

  async function submitEventAction() {
    if (!selectedEventId || !eventAction) return;
    if (operator.trim().length < 2) {
      setMutationState({
        status: 'error',
        message: 'Operator must contain at least 2 characters.',
      });
      return;
    }

    if (
      eventAction === 'resolve' &&
      !window.confirm('Resolve this operational event?')
    ) {
      return;
    }

    setMutationState({ status: 'submitting' });
    try {
      await mutateEvent(selectedEventId, eventAction, {
        operator: operator.trim(),
        note: note.trim() || undefined,
      });
      closeEventAction();
      setEventRevision((value) => value + 1);
    } catch (error: unknown) {
      setMutationState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Event action failed.',
      });
    }
  }

  function changeTab(tab: DetailTab) {
    const query = tab === 'overview' ? '' : `?tab=${tab}`;
    router.replace(`/sensors/${encodeURIComponent(code)}${query}`, {
      scroll: false,
    });
  }

  return (
    <section className="sensor-detail-page">
      <header className="sensor-detail-heading">
        <div>
          <nav aria-label="Breadcrumb">
            <Link href="/sensors">Sensors</Link>
            <span>/</span>
            <b>{station.code}</b>
          </nav>
          <h1>{station.name}</h1>
          <p>
            {station.profile.replaceAll('_', ' ')} · Bandung Basin monitoring
            network
          </p>
        </div>
        <div className="sensor-detail-actions">
          <b
            className={
              advisory
                ? 'sensor-detail-status is-advisory'
                : 'sensor-detail-status is-online'
            }
          >
            <span className="sensor-detail-status-dot" aria-hidden="true" />
            {status}
          </b>
          <button
            type="button"
            onClick={() => setRefreshRevision((value) => value + 1)}
          >
            Refresh
          </button>
          <Link href="/sensors">All sensors</Link>
        </div>
      </header>

      <nav className="sensor-detail-tabs" aria-label="Station detail sections">
        {(['overview', 'events', 'settings'] as DetailTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'is-active' : undefined}
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => changeTab(tab)}
          >
            {tab === 'overview'
              ? 'Overview'
              : tab === 'events'
                ? eventState.status === 'ready'
                  ? `Event log ${events.length}`
                  : 'Event log …'
                : 'Settings'}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <>
          <div className="sensor-detail-metrics">
            <MetricCard
              label="PM2.5 realtime"
              value={formatNumber(latest.measurements.pm25UgM3)}
              unit="µg/m³"
              accent={advisory ? 'amber' : 'green'}
            />
            <MetricCard
              label="PM10 realtime"
              value={formatNumber(latest.measurements.pm10UgM3)}
              unit="µg/m³"
            />
            <MetricCard
              label="Temperature"
              value={formatNumber(latest.measurements.temperatureC)}
              unit="°C"
            />
            <MetricCard
              label="Humidity"
              value={formatNumber(latest.measurements.humidityPct)}
              unit="% RH"
            />
          </div>
          <div className="sensor-detail-grid">
            <div className="sensor-detail-primary">
              <SensorHistoryChart
                stationCode={station.code}
                stationName={station.name}
                refreshRevision={refreshRevision}
              />
              <section className="sensor-detail-record">
                <header>
                  <strong>Observation record</strong>
                  <span>Latest deterministic sample</span>
                </header>
                <dl>
                  <div>
                    <dt>Observed at</dt>
                    <dd>{formatTime(latest.observedAt)} WIB</dd>
                  </div>
                  <div>
                    <dt>Pressure</dt>
                    <dd>{formatNumber(latest.measurements.pressureHpa)} hPa</dd>
                  </div>
                  <div>
                    <dt>Sampling cadence</dt>
                    <dd>5 minutes</dd>
                  </div>
                  <div>
                    <dt>Data model</dt>
                    <dd>AIRSIM-DETERMINISTIC-V1</dd>
                  </div>
                </dl>
              </section>
            </div>
            <aside className="sensor-detail-side">
              <section className="sensor-detail-panel">
                <header>
                  <strong>Device health</strong>
                  <span>Live telemetry</span>
                </header>
                <dl>
                  <div>
                    <dt>Battery</dt>
                    <dd>{formatNumber(latest.device.batteryVoltage, 2)} V</dd>
                  </div>
                  <div>
                    <dt>Signal</dt>
                    <dd>{latest.device.rssiDbm} dBm</dd>
                  </div>
                  <div>
                    <dt>Network</dt>
                    <dd>{latest.device.network}</dd>
                  </div>
                  <div>
                    <dt>Firmware</dt>
                    <dd>{latest.device.firmware}</dd>
                  </div>
                  <div>
                    <dt>Quality</dt>
                    <dd>{latest.quality.label}</dd>
                  </div>
                  <div>
                    <dt>Quality score</dt>
                    <dd>{formatNumber(latest.quality.score)}%</dd>
                  </div>
                </dl>
              </section>
              <section className="sensor-detail-panel">
                <header>
                  <strong>Station identity</strong>
                  <span>Registered unit</span>
                </header>
                <dl>
                  <div>
                    <dt>Code</dt>
                    <dd>{station.code}</dd>
                  </div>
                  <div>
                    <dt>Profile</dt>
                    <dd>{station.profile.replaceAll('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt>Latitude</dt>
                    <dd>{formatNumber(station.location.latitude, 5)}</dd>
                  </div>
                  <div>
                    <dt>Longitude</dt>
                    <dd>{formatNumber(station.location.longitude, 5)}</dd>
                  </div>
                  <div>
                    <dt>Elevation</dt>
                    <dd>{station.location.elevationM} m MSL</dd>
                  </div>
                </dl>
              </section>
              <section className="sensor-detail-notice">
                <strong>Simulated ground sensor data</strong>
                <p>
                  Five-minute deterministic development simulation. Not a
                  calibrated regulatory monitoring instrument.
                </p>
              </section>
            </aside>
          </div>
        </>
      ) : null}

      {activeTab === 'events' ? (
        <section className="sensor-events-view">
          <header className="sensor-tab-heading">
            <div>
              <span>Operational chronology</span>
              <h2>Event Log</h2>
              <p>
                Derived by the Event Log backend from station state and
                telemetry.
              </p>
            </div>
            <div className="sensor-event-filters">
              {(
                [
                  'ALL',
                  'INFO',
                  'CAUTION',
                  'WARNING',
                  'CRITICAL',
                ] as EventFilter[]
              ).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={eventFilter === filter ? 'is-active' : undefined}
                  onClick={() => setEventFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </header>

          {eventState.status === 'idle' || eventState.status === 'loading' ? (
            <div className="sensor-event-state">
              <strong>Loading Event Log</strong>
              <span>Requesting operational events for {station.code}.</span>
            </div>
          ) : null}

          {eventState.status === 'error' ? (
            <div className="sensor-event-state is-error">
              <strong>Event Log unavailable</strong>
              <span>{eventState.message}</span>
              <button
                type="button"
                onClick={() => setEventRevision((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          ) : null}

          {eventState.status === 'ready' && visibleEvents.length === 0 ? (
            <div className="sensor-event-state is-empty">
              <strong>No events recorded</strong>
              <span>
                No operational events match the current filter for this station.
              </span>
              {eventFilter !== 'ALL' ? (
                <button type="button" onClick={() => setEventFilter('ALL')}>
                  Clear filter
                </button>
              ) : null}
            </div>
          ) : null}

          {eventState.status === 'ready' && visibleEvents.length > 0 ? (
            <div className="sensor-event-list">
              {visibleEvents.map((event) => {
                const actionOpen = selectedEventId === event.id;
                return (
                  <article
                    key={event.id}
                    className={`sensor-event-item is-${event.severity.toLowerCase()} is-${event.status.toLowerCase()}`}
                  >
                    <div className="sensor-event-time">
                      <time>{formatTime(event.occurredAt)} WIB</time>
                      <small>Episode {event.episodeNumber}</small>
                    </div>
                    <b>
                      <span aria-hidden="true" />
                      {event.severity}
                    </b>
                    <div className="sensor-event-copy">
                      <strong>{event.title}</strong>
                      <p>{event.detail}</p>
                      <small>{event.type.replaceAll('_', ' ')}</small>

                      <div className="sensor-event-episode">
                        <header>
                          <b>Episode {event.episodeNumber}</b>
                          <span>{event.status}</span>
                        </header>
                        <dl>
                          <div>
                            <dt>First observed</dt>
                            <dd>{formatTime(event.occurredAt)} WIB</dd>
                          </div>
                          <div>
                            <dt>Last observed</dt>
                            <dd>{formatTime(event.lastObservedAt)} WIB</dd>
                          </div>
                          {event.clearedAt ? (
                            <div>
                              <dt>Recovered</dt>
                              <dd>{formatTime(event.clearedAt)} WIB</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt>
                              {event.clearedAt
                                ? 'Episode duration'
                                : 'Observed span'}
                            </dt>
                            <dd>
                              {formatRelativeDuration(
                                event.occurredAt,
                                event.clearedAt ?? event.lastObservedAt,
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {event.acknowledgedAt ? (
                        <div className="sensor-event-audit">
                          <b>Acknowledged</b>
                          <span>
                            {event.acknowledgedBy ?? 'Unknown operator'} ·{' '}
                            {formatTime(event.acknowledgedAt)} WIB
                          </span>
                          {event.acknowledgmentNote ? (
                            <p>{event.acknowledgmentNote}</p>
                          ) : null}
                        </div>
                      ) : null}

                      {event.resolvedAt ? (
                        <div className="sensor-event-audit is-resolution">
                          <b>Resolved</b>
                          <span>
                            {event.resolvedBy ?? 'Unknown operator'} ·{' '}
                            {formatTime(event.resolvedAt)} WIB
                          </span>
                          {event.resolutionNote ? (
                            <p>{event.resolutionNote}</p>
                          ) : null}
                        </div>
                      ) : null}

                      {actionOpen ? (
                        <div className="sensor-event-action-panel">
                          <strong>
                            {eventAction === 'acknowledge'
                              ? 'Acknowledge event'
                              : 'Resolve event'}
                          </strong>
                          <label>
                            <span>Operator</span>
                            <input
                              value={operator}
                              onChange={(entry) =>
                                setOperator(entry.target.value)
                              }
                              maxLength={80}
                              autoFocus
                            />
                          </label>
                          <label>
                            <span>Note</span>
                            <textarea
                              value={note}
                              onChange={(entry) => setNote(entry.target.value)}
                              maxLength={500}
                              rows={3}
                            />
                          </label>
                          {mutationState.status === 'error' ? (
                            <p className="sensor-event-mutation-error">
                              {mutationState.message}
                            </p>
                          ) : null}
                          <div>
                            <button
                              type="button"
                              onClick={closeEventAction}
                              disabled={mutationState.status === 'submitting'}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void submitEventAction()}
                              disabled={mutationState.status === 'submitting'}
                            >
                              {mutationState.status === 'submitting'
                                ? 'Saving…'
                                : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <aside className="sensor-event-operation">
                      <b
                        className={`sensor-event-status is-${event.status.toLowerCase()}`}
                      >
                        {event.status}
                      </b>
                      <small>{event.source.replaceAll('_', ' ')}</small>
                      {event.status === 'ACTIVE' ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openEventAction(event.id, 'acknowledge')
                            }
                          >
                            Acknowledge
                          </button>
                          <button
                            type="button"
                            onClick={() => openEventAction(event.id, 'resolve')}
                          >
                            Resolve
                          </button>
                        </>
                      ) : null}
                      {event.status === 'ACKNOWLEDGED' ? (
                        <button
                          type="button"
                          onClick={() => openEventAction(event.id, 'resolve')}
                        >
                          Resolve
                        </button>
                      ) : null}
                    </aside>
                  </article>
                );
              })}
            </div>
          ) : null}

          <footer className="sensor-event-disclaimer">
            Persistent operational events · acknowledgment and resolution audit
            enabled
            <Link href={`/alerts?q=${encodeURIComponent(station.code)}`}>
              View in Alerts →
            </Link>
          </footer>
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="sensor-settings-view">
          <header className="sensor-tab-heading">
            <div>
              <span>Configuration record</span>
              <h2>Sensor Settings</h2>
              <p>Review station parameters and alert thresholds.</p>
            </div>
            <b className="sensor-settings-readonly">
              Read only · simulation mode
            </b>
          </header>
          <div className="sensor-settings-grid">
            <section className="sensor-settings-panel">
              <header>
                <strong>Identification</strong>
                <span>Station record</span>
              </header>
              <label>
                <span>Display name</span>
                <input value={station.name} readOnly />
              </label>
              <label>
                <span>Station code</span>
                <input value={station.code} readOnly />
              </label>
              <label>
                <span>Profile</span>
                <input value={station.profile.replaceAll('_', ' ')} readOnly />
              </label>
            </section>
            <section className="sensor-settings-panel">
              <header>
                <strong>Sampling</strong>
                <span>Acquisition timing</span>
              </header>
              <label>
                <span>Sampling interval</span>
                <input value="5 minutes" readOnly />
              </label>
              <label>
                <span>Upload interval</span>
                <input value="5 minutes" readOnly />
              </label>
              <label>
                <span>Heartbeat interval</span>
                <input value="1 minute" readOnly />
              </label>
            </section>
            <section className="sensor-settings-panel">
              <header>
                <strong>Alert thresholds</strong>
                <span>Rule engine</span>
              </header>
              <label>
                <span>PM2.5 advisory</span>
                <input value="40.0 µg/m³" readOnly />
              </label>
              <label>
                <span>PM2.5 critical</span>
                <input value="55.0 µg/m³" readOnly />
              </label>
              <label>
                <span>Signal warning</span>
                <input value="-90 dBm" readOnly />
              </label>
              <label>
                <span>Battery critical</span>
                <input value="3.60 V" readOnly />
              </label>
            </section>
            <section className="sensor-settings-panel">
              <header>
                <strong>Device</strong>
                <span>Provisioned hardware</span>
              </header>
              <label>
                <span>Firmware</span>
                <input value={latest.device.firmware} readOnly />
              </label>
              <label>
                <span>Network</span>
                <input value={latest.device.network} readOnly />
              </label>
              <label>
                <span>Location</span>
                <input
                  value={`${formatNumber(station.location.latitude, 5)}, ${formatNumber(station.location.longitude, 5)}`}
                  readOnly
                />
              </label>
            </section>
          </div>
          <footer className="sensor-settings-footer">
            <p>
              Configuration editing will be enabled after a secure
              device-configuration API and audit trail are available.
            </p>
            <button type="button" disabled>
              Save configuration
            </button>
          </footer>
        </section>
      ) : null}
    </section>
  );
}
