import type {
  SensorEvent,
  SensorEventSeverity,
  StationWithMeasurement,
} from '@/types/sensor';

export type AlertSeverity = Exclude<SensorEventSeverity, 'INFO'>;

export type AlertKind = 'OFFLINE' | 'STALE' | 'ADVISORY' | 'DELAYED';

export interface ActiveAlert {
  id: string;
  conditionKey: string;
  episodeNumber: number;
  kind: AlertKind;
  severity: AlertSeverity;
  status: 'ACTIVE' | 'ACKNOWLEDGED';
  title: string;
  detail: string;
  occurredAt: string;
  lastObservedAt: string;
  ageMinutes: number;
  station: StationWithMeasurement['station'];
}

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  CAUTION: 2,
};

export function ageInMinutes(
  observedAt: string,
  generatedAtMs: number,
): number {
  const observed = new Date(observedAt).getTime();

  if (Number.isFinite(observed) === false) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.floor((generatedAtMs - observed) / 60_000));
}

export function eventKind(event: SensorEvent): AlertKind | null {
  const kinds: Partial<Record<SensorEvent['type'], AlertKind>> = {
    STATION_OFFLINE: 'OFFLINE',
    TELEMETRY_STALE: 'STALE',
    AIR_QUALITY_ADVISORY: 'ADVISORY',
    TELEMETRY_DELAYED: 'DELAYED',
  };

  return kinds[event.type] ?? null;
}

export function buildAlerts(
  stations: StationWithMeasurement[],
  events: SensorEvent[],
  generatedAtMs: number,
): ActiveAlert[] {
  const stationsByCode = new Map(
    stations.map((item) => [item.station.code, item.station]),
  );

  return events.flatMap((event) => {
    if (event.status === 'RESOLVED' || event.severity === 'INFO') {
      return [];
    }

    const station = stationsByCode.get(event.sensorCode);

    const kind = eventKind(event);

    if (!station || !kind) {
      return [];
    }

    return [
      {
        id: event.id,
        conditionKey: event.conditionKey,
        episodeNumber: event.episodeNumber,
        kind,
        severity: event.severity,
        status: event.status,
        title: event.title,
        detail: event.detail,
        occurredAt: event.occurredAt,
        lastObservedAt: event.lastObservedAt,
        ageMinutes: ageInMinutes(event.occurredAt, generatedAtMs),
        station,
      },
    ];
  });
}

export function sortAlertsBySeverity(alerts: ActiveAlert[]): ActiveAlert[] {
  return [...alerts].sort(
    (first, second) =>
      SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity] ||
      second.ageMinutes - first.ageMinutes ||
      first.station.code.localeCompare(second.station.code),
  );
}
