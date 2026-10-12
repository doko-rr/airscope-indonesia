export type EventSeverity = 'INFO' | 'CAUTION' | 'WARNING' | 'CRITICAL';
export type EventStatus = 'ACTIVE' | 'RESOLVED';

export type SensorEventType =
  | 'AIR_QUALITY_ADVISORY'
  | 'STATION_OFFLINE'
  | 'TELEMETRY_DELAYED'
  | 'TELEMETRY_STALE'
  | 'STATION_RECOVERED';

export interface SensorEvent {
  id: string;
  sensorCode: string;
  type: SensorEventType;
  severity: EventSeverity;
  status: EventStatus;
  title: string;
  detail: string;
  occurredAt: string;
  resolvedAt: string | null;
  source: 'DERIVED_SIMULATION';
}
