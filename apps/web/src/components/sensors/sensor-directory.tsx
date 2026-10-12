'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useRef } from 'react';
import type { StationWithMeasurement } from '@/types/sensor';

type StatusFilter = 'ALL' | 'ONLINE' | 'ADVISORY' | 'OFFLINE';
type IssueFilter = 'ALL' | 'ADVISORY' | 'OFFLINE' | 'DELAYED' | 'STALE';
type ProfileFilter = 'ALL' | 'BACKGROUND' | 'ROADSIDE' | 'INDUSTRIAL';
type SortKey = 'PM25_DESC' | 'NAME_ASC' | 'STATUS' | 'RECENT';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function unwrap<T>(payload: T | { data: T }): T {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`API request failed with HTTP ${response.status}`);
  }
  return unwrap<T>((await response.json()) as T | { data: T });
}

async function loadStations(): Promise<StationWithMeasurement[]> {
  const stations =
    await fetchJson<
      Array<StationWithMeasurement['station'] | StationWithMeasurement>
    >('/sensors');

  return Promise.all(
    stations.map(async (item) => {
      if ('latest' in item) return item;

      const latest = await fetchJson<StationWithMeasurement['latest']>(
        `/sensors/${item.code}/latest`,
      );
      return { station: item, latest };
    }),
  );
}

function normalizedStatus(item: StationWithMeasurement): StatusFilter {
  if (item.station.status === 'WARNING') return 'ADVISORY';
  if (item.station.status === 'OFFLINE') return 'OFFLINE';
  return 'ONLINE';
}

function normalizedProfile(profile: string): ProfileFilter {
  const normalized = profile.toUpperCase();
  if (normalized.includes('ROAD')) return 'ROADSIDE';
  if (normalized.includes('INDUSTR')) return 'INDUSTRIAL';
  return 'BACKGROUND';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
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

function telemetryAgeMinutes(observedAt: string): number {
  const observedTime = new Date(observedAt).getTime();
  if (!Number.isFinite(observedTime)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - observedTime) / 60_000));
}

function formatLastSeen(observedAt: string): string {
  const ageMinutes = telemetryAgeMinutes(observedAt);
  if (!Number.isFinite(ageMinutes)) return 'Unknown';
  if (ageMinutes < 1) return 'Just now';
  if (ageMinutes === 1) return '1 min ago';
  if (ageMinutes < 60) return `${ageMinutes} min ago`;

  const hours = Math.floor(ageMinutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function communicationState(observedAt: string): 'LIVE' | 'DELAYED' | 'STALE' {
  const ageMinutes = telemetryAgeMinutes(observedAt);
  if (ageMinutes <= 10) return 'LIVE';
  if (ageMinutes <= 20) return 'DELAYED';
  return 'STALE';
}

export function SensorDirectory() {
  const router = useRouter();
  const autocompleteRef = useRef<HTMLLabelElement>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const [stations, setStations] = useState<StationWithMeasurement[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('ALL');
  const [profile, setProfile] = useState<ProfileFilter>('ALL');
  const [sort, setSort] = useState<SortKey>('PM25_DESC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadStations()
      .then((items) => {
        if (!active) return;
        setStations(items);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Sensor directory could not be loaded.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      total: stations.length,
      online: stations.filter((item) => normalizedStatus(item) === 'ONLINE')
        .length,
      advisory: stations.filter((item) => normalizedStatus(item) === 'ADVISORY')
        .length,
      offline: stations.filter((item) => normalizedStatus(item) === 'OFFLINE')
        .length,
    }),
    [stations],
  );

  const activeIssueCounts = useMemo(
    () => ({
      advisory: stations.filter((item) => normalizedStatus(item) === 'ADVISORY')
        .length,
      offline: stations.filter((item) => normalizedStatus(item) === 'OFFLINE')
        .length,
      delayed: stations.filter(
        (item) => communicationState(item.latest.observedAt) === 'DELAYED',
      ).length,
      stale: stations.filter(
        (item) => communicationState(item.latest.observedAt) === 'STALE',
      ).length,
    }),
    [stations],
  );

  const totalActiveIssues = useMemo(
    () =>
      stations.reduce((total, item) => {
        const stationStatus = normalizedStatus(item);
        const telemetryState = communicationState(item.latest.observedAt);

        if (stationStatus === 'OFFLINE') return total + 1;
        if (telemetryState === 'STALE') return total + 1;

        return (
          total +
          (stationStatus === 'ADVISORY' ? 1 : 0) +
          (telemetryState === 'DELAYED' ? 1 : 0)
        );
      }, 0),
    [stations],
  );

  function toggleIssueFilter(value: Exclude<IssueFilter, 'ALL'>) {
    setIssueFilter((current) => (current === value ? 'ALL' : value));
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = stations.filter((item) => {
      const stationStatus = normalizedStatus(item);
      const stationProfile = normalizedProfile(item.station.profile);
      const stationCommunication = communicationState(item.latest.observedAt);
      const matchesIssue =
        issueFilter === 'ALL' ||
        (issueFilter === 'ADVISORY' && stationStatus === 'ADVISORY') ||
        (issueFilter === 'OFFLINE' && stationStatus === 'OFFLINE') ||
        (issueFilter === 'DELAYED' && stationCommunication === 'DELAYED') ||
        (issueFilter === 'STALE' && stationCommunication === 'STALE');
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [item.station.code, item.station.name, item.station.profile]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesQuery &&
        matchesIssue &&
        (status === 'ALL' || stationStatus === status) &&
        (profile === 'ALL' || stationProfile === profile)
      );
    });

    return [...result].sort((first, second) => {
      if (sort === 'NAME_ASC') {
        return first.station.name.localeCompare(second.station.name);
      }
      if (sort === 'STATUS') {
        return normalizedStatus(first).localeCompare(normalizedStatus(second));
      }
      if (sort === 'RECENT') {
        return (
          new Date(second.latest.observedAt).getTime() -
          new Date(first.latest.observedAt).getTime()
        );
      }
      return (
        second.latest.measurements.pm25UgM3 - first.latest.measurements.pm25UgM3
      );
    });
  }, [issueFilter, profile, query, sort, stations, status]);

  const autocompleteSuggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return stations
      .filter((item) =>
        [item.station.code, item.station.name, item.station.profile]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 5);
  }, [query, stations]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setSuggestionsOpen(false);
        setActiveSuggestion(-1);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function openStation(item: StationWithMeasurement) {
    setQuery(item.station.name);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    router.push(`/sensors/${encodeURIComponent(item.station.code)}`);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) =>
        Math.min(current + 1, autocompleteSuggestions.length - 1),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
      return;
    }

    if (
      event.key === 'Enter' &&
      activeSuggestion >= 0 &&
      autocompleteSuggestions[activeSuggestion]
    ) {
      event.preventDefault();
      openStation(autocompleteSuggestions[activeSuggestion]);
    }
  }

  return (
    <div className="sensor-directory-shell">
      <aside className="sensor-directory-sidebar">
        <Link className="sensor-directory-brand" href="/">
          <strong>AirScope</strong>
          <span>Indonesia</span>
        </Link>
        <p>Observation rail</p>
        <nav aria-label="Primary navigation">
          <Link href="/">
            <b>01</b>
            <span>Overview</span>
          </Link>
          <Link className="is-active" href="/sensors" aria-current="page">
            <b>02</b>
            <span>Sensors</span>
          </Link>
          <span>
            <b>03</b>
            <i>Satellite</i>
          </span>
          <span>
            <b>04</b>
            <i>Comparison</i>
          </span>
          <Link href="/alerts">
            <b>05</b>
            <span>Alerts</span>
            <em>{String(totalActiveIssues).padStart(2, '0')}</em>
          </Link>
          <span>
            <b>06</b>
            <i>Devices</i>
          </span>
          <span>
            <b>07</b>
            <i>Reports</i>
          </span>
          <span>
            <b>08</b>
            <i>Settings</i>
          </span>
        </nav>
        <footer>
          <span>Ground network</span>
          <strong>
            {counts.online + counts.advisory} / {counts.total || '—'} reporting
          </strong>
        </footer>
      </aside>

      <main className="sensor-directory-main">
        <header className="sensor-directory-topbar">
          <div>
            <strong>Bandung Basin Monitoring Network</strong>
            <span>
              Station status · air-quality observations · device telemetry
            </span>
          </div>
          <div>
            <span className="directory-online-dot" />
            System online
          </div>
        </header>

        <section className="sensor-directory-content">
          <div className="sensor-directory-heading">
            <div>
              <h1>Sensor Directory</h1>
              <p>
                Search, filter, and inspect monitoring stations across the
                Bandung Basin.
              </p>
            </div>
            <aside>
              <span>Monitor</span>
              <b>›</b>
              <span>Analyze</span>
              <b>›</b>
              <span>Respond</span>
              <strong>Cleaner air for a healthier Indonesia</strong>
            </aside>
          </div>

          <div className="sensor-directory-metrics">
            <article>
              <span>Total stations</span>
              <strong>{counts.total}</strong>
              <small>Registered units</small>
            </article>
            <article className="is-online">
              <span>Online</span>
              <strong>{counts.online}</strong>
              <small>Stable stations</small>
            </article>
            <article className="is-advisory">
              <span>Advisory</span>
              <strong>{counts.advisory}</strong>
              <small>Requires attention</small>
            </article>
            <article>
              <span>Offline</span>
              <strong>{counts.offline}</strong>
              <small>No communication</small>
            </article>
          </div>

          <section
            className="sensor-active-issues"
            aria-labelledby="active-issues-title"
          >
            <div className="sensor-active-issues-heading">
              <div>
                <span>Operational triage</span>
                <h2 id="active-issues-title">
                  Active Issues <b>{totalActiveIssues}</b>
                </h2>
              </div>

              <div className="sensor-active-issues-actions">
                {issueFilter !== 'ALL' ? (
                  <button type="button" onClick={() => setIssueFilter('ALL')}>
                    Clear ×
                  </button>
                ) : null}
                <Link href="/alerts">View all alerts →</Link>
              </div>
            </div>

            <div className="sensor-active-issues-strip">
              {(
                [
                  [
                    'ADVISORY',
                    'Air-quality advisory',
                    activeIssueCounts.advisory,
                    'is-advisory',
                  ],
                  [
                    'DELAYED',
                    'Delayed telemetry',
                    activeIssueCounts.delayed,
                    'is-delayed',
                  ],
                  [
                    'STALE',
                    'Stale telemetry',
                    activeIssueCounts.stale,
                    'is-stale',
                  ],
                ] as const
              ).map(([value, label, count, tone]) => (
                <button
                  key={value}
                  type="button"
                  className={`${tone}${issueFilter === value ? ' is-active' : ''}${
                    count === 0 ? ' is-zero' : ''
                  }`}
                  aria-pressed={issueFilter === value}
                  onClick={() =>
                    router.push(`/alerts?type=${value.toLowerCase()}`)
                  }
                >
                  <i aria-hidden="true" />
                  <span>{label}</span>
                  <strong>{count}</strong>
                </button>
              ))}
            </div>
          </section>

          <section
            className="sensor-directory-filters"
            aria-label="Sensor filters"
          >
            <label
              className="sensor-search sensor-search-autocomplete"
              ref={autocompleteRef}
            >
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSuggestionsOpen(true);
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search station name, code, or profile..."
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen && query.trim().length > 0}
                aria-controls="sensor-search-suggestions"
                aria-activedescendant={
                  activeSuggestion >= 0
                    ? `sensor-suggestion-${activeSuggestion}`
                    : undefined
                }
                autoComplete="off"
              />

              {suggestionsOpen && query.trim() ? (
                <div
                  id="sensor-search-suggestions"
                  className="sensor-search-suggestions"
                  role="listbox"
                >
                  {autocompleteSuggestions.length ? (
                    autocompleteSuggestions.map((item, index) => (
                      <button
                        id={`sensor-suggestion-${index}`}
                        key={item.station.code}
                        type="button"
                        role="option"
                        aria-selected={activeSuggestion === index}
                        className={
                          activeSuggestion === index ? 'is-active' : undefined
                        }
                        onMouseEnter={() => setActiveSuggestion(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => openStation(item)}
                      >
                        <span>
                          <strong>{item.station.name}</strong>
                          <small>
                            {item.station.code} ·{' '}
                            {item.station.profile.replaceAll('_', ' ')}
                          </small>
                          <small className="sensor-last-seen">
                            Last seen {formatLastSeen(item.latest.observedAt)}
                          </small>
                        </span>
                        <b
                          className={
                            normalizedStatus(item) === 'ADVISORY'
                              ? 'is-advisory'
                              : undefined
                          }
                        >
                          {normalizedStatus(item)}
                        </b>
                        <em>
                          {item.latest.measurements.pm25UgM3.toFixed(1)} µg/m³
                          <i
                            className={`sensor-communication is-${communicationState(
                              item.latest.observedAt,
                            ).toLowerCase()}`}
                          >
                            {communicationState(item.latest.observedAt)}
                          </i>
                        </em>
                      </button>
                    ))
                  ) : (
                    <p>No matching sensors</p>
                  )}
                  <footer>
                    <span>↑↓ Navigate</span>
                    <span>Enter Open</span>
                    <span>Esc Close</span>
                  </footer>
                </div>
              ) : null}
            </label>

            <fieldset>
              <legend>Status</legend>
              {(['ALL', 'ONLINE', 'ADVISORY', 'OFFLINE'] as StatusFilter[]).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    className={status === value ? 'is-active' : undefined}
                    onClick={() => setStatus(value)}
                  >
                    {value}
                  </button>
                ),
              )}
            </fieldset>

            <fieldset>
              <legend>Profile</legend>
              {(
                [
                  'ALL',
                  'BACKGROUND',
                  'ROADSIDE',
                  'INDUSTRIAL',
                ] as ProfileFilter[]
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={profile === value ? 'is-active' : undefined}
                  onClick={() => setProfile(value)}
                >
                  {value === 'ALL' ? 'ALL' : value}
                </button>
              ))}
            </fieldset>

            <label className="sensor-sort">
              <span>Sort by</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                <option value="PM25_DESC">Highest PM2.5</option>
                <option value="NAME_ASC">Station name</option>
                <option value="STATUS">Status</option>
                <option value="RECENT">Latest observation</option>
              </select>
            </label>
          </section>

          <section className="sensor-directory-table-panel">
            {loading ? (
              <div className="sensor-directory-state">
                Loading sensor directory…
              </div>
            ) : null}
            {error ? (
              <div className="sensor-directory-state is-error">
                <strong>Directory unavailable</strong>
                <span>{error}</span>
              </div>
            ) : null}
            {!loading && !error && filtered.length === 0 ? (
              <div className="sensor-directory-state">
                <strong>No stations match these filters</strong>
                <span>Change the search terms or reset a filter.</span>
              </div>
            ) : null}

            {!loading && !error && filtered.length > 0 ? (
              <div className="sensor-directory-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Station</th>
                      <th>Profile</th>
                      <th>Status</th>
                      <th>PM2.5</th>
                      <th>PM10</th>
                      <th>Temp</th>
                      <th>Humidity</th>
                      <th>Battery</th>
                      <th>Signal</th>
                      <th>Last observation</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, index) => {
                      const rowStatus = normalizedStatus(item);
                      return (
                        <tr
                          key={item.station.code}
                          className={
                            rowStatus === 'ADVISORY' ? 'is-advisory' : undefined
                          }
                        >
                          <td>{String(index + 1).padStart(2, '0')}</td>
                          <td>
                            <strong>{item.station.code}</strong>
                            <span>{item.station.name}</span>
                          </td>
                          <td>{item.station.profile.replaceAll('_', ' ')}</td>
                          <td>
                            <b
                              className={`directory-status is-${rowStatus.toLowerCase()}`}
                            >
                              {rowStatus}
                            </b>
                          </td>
                          <td>
                            <strong>
                              {formatNumber(item.latest.measurements.pm25UgM3)}
                            </strong>
                          </td>
                          <td>
                            {formatNumber(item.latest.measurements.pm10UgM3)}
                          </td>
                          <td>
                            {formatNumber(
                              item.latest.measurements.temperatureC,
                            )}{' '}
                            °C
                          </td>
                          <td>
                            {formatNumber(item.latest.measurements.humidityPct)}
                            %
                          </td>
                          <td>
                            {formatNumber(item.latest.device.batteryVoltage)} V
                          </td>
                          <td>{item.latest.device.rssiDbm} dBm</td>
                          <td>
                            {formatTime(item.latest.observedAt)}
                            <small className="directory-last-seen-inline">
                              {formatLastSeen(item.latest.observedAt)}
                            </small>
                          </td>
                          <td>
                            <Link href={`/sensors/${item.station.code}`}>
                              Inspect <span>→</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            <footer>
              <span>
                Showing {filtered.length} of {stations.length} stations
              </span>
              <span>
                Source: <strong>AIRSIM-DETERMINISTIC-V1</strong>
              </span>
            </footer>
          </section>
        </section>
      </main>
    </div>
  );
}
