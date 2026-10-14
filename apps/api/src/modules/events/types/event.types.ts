export type EventSeverity = 'INFO' | 'CAUTION' | 'WARNING' | 'CRITICAL';
export type EventStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export type SensorEventType =
  | 'AIR_QUALITY_ADVISORY'
  | 'STATION_OFFLINE'
  | 'TELEMETRY_DELAYED'
  | 'TELEMETRY_STALE'
  | 'STATION_RECOVERED';

export interface SensorEvent {
  id: string;
  conditionKey: string;
  episodeNumber: number;
  sensorCode: string;
  type: SensorEventType;
  severity: EventSeverity;
  status: EventStatus;
  title: string;
  detail: string;
  occurredAt: string;
  lastObservedAt: string;
  clearedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgmentNote: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  source: 'DERIVED_SIMULATION';
}
