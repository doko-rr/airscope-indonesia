import Link from 'next/link';
import type { StationWithMeasurement } from '@/types/sensor';

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'CAUTION';
type AlertKind = 'OFFLINE' | 'STALE' | 'ADVISORY' | 'DELAYED';

interface ActiveAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  observedAt: string;
  ageMinutes: number;
  station: StationWithMeasurement['station'];
}

interface AlertsDirectoryProps {
  stations: StationWithMeasurement[];
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  CAUTION: 2,
};

function ageInMinutes(observedAt: string): number {
  const observed = new Date(observedAt).getTime();
  if (!Number.isFinite(observed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - observed) / 60_000));
}

function normalizedStatus(item: StationWithMeasurement): string {
  return String(item.station.status).toUpperCase();
}

function formatAge(minutes: number): string {
  if (!Number.isFinite(minutes)) return 'Unknown age';
  if (minutes < 1) return 'Observed less than 1 minute ago';
  if (minutes < 60) return `Observed ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `Observed ${hours}h ${remainder}m ago`;
}

function buildAlerts(stations: StationWithMeasurement[]): ActiveAlert[] {
  const alerts: ActiveAlert[] = [];

  for (const item of stations) {
    const status = normalizedStatus(item);
    const ageMinutes = ageInMinutes(item.latest.observedAt);
    const offline = status === 'OFFLINE';
    const stale = ageMinutes > 20;
    const delayed = ageMinutes >= 11 && ageMinutes <= 20;
    const advisory = status === 'WARNING' || status === 'ADVISORY';

    // Communication failures take precedence. An offline station is not also
    // emitted as stale, preventing duplicate alerts for the same root cause.
    if (offline) {
      alerts.push({
        id: `${item.station.code}-offline`,
        kind: 'OFFLINE',
        severity: 'CRITICAL',
        title: 'Station offline',
        detail: 'The station is not reporting to the observation network.',
        observedAt: item.latest.observedAt,
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
        observedAt: item.latest.observedAt,
        ageMinutes,
        station: item.station,
      });
      continue;
    }

    // Air-quality advisories are only shown while telemetry is current enough
    // to support an operational air-quality decision.
    if (advisory) {
      alerts.push({
        id: `${item.station.code}-advisory`,
        kind: 'ADVISORY',
        severity: 'WARNING',
        title: 'Air-quality advisory',
        detail: `PM2.5 is ${item.latest.measurements.pm25UgM3.toFixed(1)} µg/m³ and requires attention.`,
        observedAt: item.latest.observedAt,
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
        observedAt: item.latest.observedAt,
        ageMinutes,
        station: item.station,
      });
    }
  }

  return alerts.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.ageMinutes - a.ageMinutes ||
      a.station.code.localeCompare(b.station.code),
  );
}

export function AlertsDirectory({ stations }: AlertsDirectoryProps) {
  const alerts = buildAlerts(stations);
  const counts = {
    critical: alerts.filter((alert) => alert.severity === 'CRITICAL').length,
    warning: alerts.filter((alert) => alert.severity === 'WARNING').length,
    caution: alerts.filter((alert) => alert.severity === 'CAUTION').length,
  };

  return (
    <>
      <section
        className="alerts-severity-summary"
        aria-label="Alert severity summary"
      >
        <article className="is-total">
          <span>Active alerts</span>
          <strong>{alerts.length}</strong>
          <small>Across {stations.length} stations</small>
        </article>
        <article className="is-critical">
          <span>Critical</span>
          <strong>{counts.critical}</strong>
          <small>Offline or stale</small>
        </article>
        <article className="is-warning">
          <span>Warning</span>
          <strong>{counts.warning}</strong>
          <small>Air-quality advisory</small>
        </article>
        <article className="is-caution">
          <span>Caution</span>
          <strong>{counts.caution}</strong>
          <small>Delayed telemetry</small>
        </article>
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
          <small>Critical → Warning → Caution</small>
        </header>

        {alerts.length === 0 ? (
          <div className="alerts-empty-state is-healthy">
            <span>Network clear</span>
            <h2>No active alerts detected.</h2>
            <p>All stations are within the current operational rules.</p>
            <Link href="/sensors">Review sensor directory →</Link>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((alert) => (
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
