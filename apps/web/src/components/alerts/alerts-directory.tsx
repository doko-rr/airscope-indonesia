'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { StationWithMeasurement } from '@/types/sensor';

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'CAUTION';
type AlertKind = 'OFFLINE' | 'STALE' | 'ADVISORY' | 'DELAYED';
type SeverityFilter = 'ALL' | AlertSeverity;
type KindFilter = 'ALL' | AlertKind;
type AlertSort = 'SEVERITY' | 'OLDEST' | 'NEWEST' | 'STATION';

interface ActiveAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  ageMinutes: number;
  station: StationWithMeasurement['station'];
}

interface AlertsDirectoryProps {
  stations: StationWithMeasurement[];
  generatedAtMs: number;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  CAUTION: 2,
};

function ageInMinutes(observedAt: string, generatedAtMs: number): number {
  const observed = new Date(observedAt).getTime();
  if (!Number.isFinite(observed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((generatedAtMs - observed) / 60_000));
}

function normalizedStatus(item: StationWithMeasurement): string {
  return String(item.station.status).toUpperCase();
}

function formatAge(minutes: number): string {
  if (!Number.isFinite(minutes)) return 'Unknown age';
  if (minutes < 1) return 'Observed less than 1 minute ago';
  if (minutes < 60) return `Observed ${minutes} minutes ago`;
  return `Observed ${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

function buildAlerts(
  stations: StationWithMeasurement[],
  generatedAtMs: number,
): ActiveAlert[] {
  const alerts: ActiveAlert[] = [];

  for (const item of stations) {
    const status = normalizedStatus(item);
    const ageMinutes = ageInMinutes(item.latest.observedAt, generatedAtMs);
    const offline = status === 'OFFLINE';
    const stale = ageMinutes > 20;
    const delayed = ageMinutes >= 11 && ageMinutes <= 20;
    const advisory = status === 'WARNING' || status === 'ADVISORY';

    if (offline) {
      alerts.push({
        id: `${item.station.code}-offline`,
        kind: 'OFFLINE',
        severity: 'CRITICAL',
        title: 'Station offline',
        detail: 'The station is not reporting to the observation network.',
        ageMinutes,
        station: item.station,
      });
      continue;
    }

    if (stale) {
      alerts.push({
        id: `${item.station.code}-stale`,
        kind: 'STALE',
        severity: 'CRITICAL',
        title: 'Telemetry stale',
        detail: 'The latest observation is more than 20 minutes old.',
        ageMinutes,
        station: item.station,
      });
      continue;
    }

    if (advisory) {
      alerts.push({
        id: `${item.station.code}-advisory`,
        kind: 'ADVISORY',
        severity: 'WARNING',
        title: 'Air-quality advisory',
        detail: `PM2.5 is ${item.latest.measurements.pm25UgM3.toFixed(1)} µg/m³ and requires attention.`,
        ageMinutes,
        station: item.station,
      });
    }

    if (delayed) {
      alerts.push({
        id: `${item.station.code}-delayed`,
        kind: 'DELAYED',
        severity: 'CAUTION',
        title: 'Telemetry delayed',
        detail: 'The latest observation is between 11 and 20 minutes old.',
        ageMinutes,
        station: item.station,
      });
    }
  }

  return alerts;
}

function enumParam<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  const normalized = value?.toUpperCase() as T | undefined;
  return normalized && allowed.includes(normalized) ? normalized : fallback;
}

export function AlertsDirectory({
  stations,
  generatedAtMs,
}: AlertsDirectoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const severity = enumParam<SeverityFilter>(
    searchParams.get('severity'),
    ['ALL', 'CRITICAL', 'WARNING', 'CAUTION'],
    'ALL',
  );
  const kind = enumParam<KindFilter>(
    searchParams.get('type'),
    ['ALL', 'OFFLINE', 'STALE', 'ADVISORY', 'DELAYED'],
    'ALL',
  );
  const sort = enumParam<AlertSort>(
    searchParams.get('sort'),
    ['SEVERITY', 'OLDEST', 'NEWEST', 'STATION'],
    'SEVERITY',
  );

  const alerts = useMemo(
    () => buildAlerts(stations, generatedAtMs),
    [generatedAtMs, stations],
  );

  const counts = useMemo(
    () => ({
      critical: alerts.filter((alert) => alert.severity === 'CRITICAL').length,
      warning: alerts.filter((alert) => alert.severity === 'WARNING').length,
      caution: alerts.filter((alert) => alert.severity === 'CAUTION').length,
    }),
    [alerts],
  );

  const visibleAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return alerts
      .filter((alert) => {
        const searchable = [
          alert.station.code,
          alert.station.name,
          alert.station.profile,
          alert.title,
          alert.kind,
          alert.severity,
        ]
          .join(' ')
          .toLowerCase();
        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (severity === 'ALL' || alert.severity === severity) &&
          (kind === 'ALL' || alert.kind === kind)
        );
      })
      .sort((a, b) => {
        if (sort === 'OLDEST') return b.ageMinutes - a.ageMinutes;
        if (sort === 'NEWEST') return a.ageMinutes - b.ageMinutes;
        if (sort === 'STATION')
          return a.station.code.localeCompare(b.station.code);
        return (
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
          b.ageMinutes - a.ageMinutes ||
          a.station.code.localeCompare(b.station.code)
        );
      });
  }, [alerts, kind, query, severity, sort]);

  function updateParam(name: string, value: string, defaultValue = 'ALL') {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === defaultValue) params.delete(name);
    else params.set(name, value.toLowerCase());
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, {
      scroll: false,
    });
  }

  function clearFilters() {
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = Boolean(
    query || severity !== 'ALL' || kind !== 'ALL' || sort !== 'SEVERITY',
  );

  return (
    <>
      <section
        className="alerts-severity-summary"
        aria-label="Alert severity summary"
      >
        <button
          type="button"
          className="is-total"
          onClick={clearFilters}
          aria-label="Show all active alerts"
        >
          <span>Active alerts</span>
          <strong>{alerts.length}</strong>
          <small>Across {stations.length} stations</small>
        </button>
        <button
          type="button"
          className="is-critical"
          onClick={() => updateParam('severity', 'CRITICAL')}
          aria-pressed={severity === 'CRITICAL'}
        >
          <span>Critical</span>
          <strong>{counts.critical}</strong>
          <small>Offline or stale</small>
        </button>
        <button
          type="button"
          className="is-warning"
          onClick={() => updateParam('severity', 'WARNING')}
          aria-pressed={severity === 'WARNING'}
        >
          <span>Warning</span>
          <strong>{counts.warning}</strong>
          <small>Air-quality advisory</small>
        </button>
        <button
          type="button"
          className="is-caution"
          onClick={() => updateParam('severity', 'CAUTION')}
          aria-pressed={severity === 'CAUTION'}
        >
          <span>Caution</span>
          <strong>{counts.caution}</strong>
          <small>Delayed telemetry</small>
        </button>
      </section>

      <section className="alerts-filter-bar" aria-label="Alert filters">
        <label className="alerts-search">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => updateParam('q', event.target.value, '')}
            placeholder="Station, type, severity, profile"
          />
        </label>
        <label>
          <span>Severity</span>
          <select
            value={severity}
            onChange={(event) => updateParam('severity', event.target.value)}
          >
            <option>ALL</option>
            <option>CRITICAL</option>
            <option>WARNING</option>
            <option>CAUTION</option>
          </select>
        </label>
        <label>
          <span>Alert type</span>
          <select
            value={kind}
            onChange={(event) => updateParam('type', event.target.value)}
          >
            <option>ALL</option>
            <option>OFFLINE</option>
            <option>STALE</option>
            <option>ADVISORY</option>
            <option>DELAYED</option>
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(event) =>
              updateParam('sort', event.target.value, 'SEVERITY')
            }
          >
            <option value="SEVERITY">SEVERITY</option>
            <option value="OLDEST">OLDEST TELEMETRY</option>
            <option value="NEWEST">NEWEST TELEMETRY</option>
            <option value="STATION">STATION CODE</option>
          </select>
        </label>
        {hasFilters ? (
          <button type="button" onClick={clearFilters}>
            Clear filters ×
          </button>
        ) : null}
      </section>

      <section
        className="alerts-register"
        aria-labelledby="active-alerts-title"
      >
        <header>
          <div>
            <span>Prioritized queue</span>
            <h2 id="active-alerts-title">Active alerts</h2>
          </div>
          <small>
            Showing {visibleAlerts.length} of {alerts.length}
          </small>
        </header>
        {visibleAlerts.length === 0 ? (
          <div className="alerts-empty-state is-healthy">
            <span>No matches</span>
            <h2>No alerts match the current filters.</h2>
            <p>Change the search criteria or clear all active filters.</p>
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="alerts-list">
            {visibleAlerts.map((alert) => (
              <article
                key={alert.id}
                className={`alert-row is-${alert.severity.toLowerCase()}`}
              >
                <div className="alert-severity">
                  <i aria-hidden="true" />
                  <span>{alert.severity}</span>
                  <small>{alert.kind}</small>
                </div>
                <div className="alert-copy">
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                  <small>{formatAge(alert.ageMinutes)}</small>
                </div>
                <div className="alert-station">
                  <strong>{alert.station.code}</strong>
                  <span>{alert.station.name}</span>
                  <small>{alert.station.profile.replaceAll('_', ' ')}</small>
                </div>
                <Link
                  href={`/sensors/${encodeURIComponent(alert.station.code)}?tab=events`}
                >
                  Open sensor →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
