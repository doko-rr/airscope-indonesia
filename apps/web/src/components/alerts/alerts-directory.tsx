'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  buildAlerts,
  SEVERITY_ORDER,
  type AlertKind,
  type AlertSeverity,
} from '@/lib/events/alerts';
import type { SensorEvent, StationWithMeasurement } from '@/types/sensor';

type SeverityFilter = 'ALL' | AlertSeverity;
type KindFilter = 'ALL' | AlertKind;
type AlertSort = 'SEVERITY' | 'OLDEST' | 'NEWEST' | 'STATION';

interface AlertsDirectoryProps {
  stations: StationWithMeasurement[];
  events: SensorEvent[];
  generatedAtMs: number;
}

function formatAge(minutes: number): string {
  if (!Number.isFinite(minutes)) return 'Unknown age';
  if (minutes < 1) return 'Observed less than 1 minute ago';
  if (minutes < 60) return `Observed ${minutes} minutes ago`;
  return `Observed ${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
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
  events,
  generatedAtMs,
}: AlertsDirectoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(query);

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

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    if (searchInput === query) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      const normalizedSearch = searchInput.trim();

      if (normalizedSearch) {
        params.set('q', normalizedSearch);
      } else {
        params.delete('q');
      }

      router.replace(
        `${pathname}${params.size ? `?${params.toString()}` : ''}`,
        {
          scroll: false,
        },
      );
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pathname, query, router, searchInput, searchParams]);

  const alerts = useMemo(
    () => buildAlerts(stations, events, generatedAtMs),
    [events, generatedAtMs, stations],
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
    const normalizedQuery = searchInput.trim().toLowerCase();
    return alerts
      .filter((alert) => {
        const searchable = [
          alert.station.code,
          alert.station.name,
          alert.station.profile,
          alert.title,
          alert.kind,
          alert.severity,
          alert.status,
          `episode ${alert.episodeNumber}`,
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
  }, [alerts, kind, searchInput, severity, sort]);

  function updateParam(name: string, value: string, defaultValue = 'ALL') {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === defaultValue) params.delete(name);
    else params.set(name, value.toLowerCase());
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, {
      scroll: false,
    });
  }

  function clearFilters() {
    setSearchInput('');
    router.replace(pathname, {
      scroll: false,
    });
  }

  const hasFilters = Boolean(
    searchInput.trim() ||
    severity !== 'ALL' ||
    kind !== 'ALL' ||
    sort !== 'SEVERITY',
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
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
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
                  <div className="alert-episode-meta">
                    <b>Episode {alert.episodeNumber}</b>
                    <span>{alert.status}</span>
                    <small>{formatAge(alert.ageMinutes)}</small>
                  </div>
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
