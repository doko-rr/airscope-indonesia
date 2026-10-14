export type SensorStatus = 'ONLINE' | 'WARNING' | 'OFFLINE' | 'MAINTENANCE';

export type SensorProfile =
  | 'URBAN_TRAFFIC'
  | 'RESIDENTIAL'
  | 'ROADSIDE'
  | 'INDUSTRIAL'
  | 'BACKGROUND'
  | 'SUBURBAN';

export interface SensorStation {
  code: string;
  name: string;
  city: string;
  province: string;
  timezone: string;
  profile: SensorProfile;
  status: SensorStatus;
  location: {
    latitude: number;
    longitude: number;
    elevationM: number;
  };
  firmware: string;
  isSimulated: boolean;
  installedAt: string;
  calibrationAt: string;
}

export interface SensorMeasurement {
  stationCode: string;
  observedAt: string;
  source: 'SIMULATION';
  simulationModel: string;
  measurements: {
    pm25UgM3: number;
    pm10UgM3: number;
    coPpm: number;
    co2Ppm: number;
    no2Ppb: number;
    so2Ppb: number;
    o3Ppb: number;
    temperatureC: number;
    humidityPct: number;
    pressureHpa: number;
  };
  device: {
    status: SensorStatus;
    batteryVoltage: number;
    rssiDbm: number;
    network: 'LTE';
    firmware: string;
  };
  quality: {
    score: number;
    label: 'GOOD' | 'MODERATE' | 'LOW';
  };
}

export interface SensorsResponse {
  data: SensorStation[];
  metadata: {
    count: number;
    source: 'SIMULATION';
    notice: string;
  };
}

export interface LatestMeasurementResponse {
  data: SensorMeasurement;
}

export interface StationWithMeasurement {
  station: SensorStation;
  latest: SensorMeasurement;
}

export interface SensorHistoryPoint {
  observedAt: string;
  pm25UgM3: number;
  pm10UgM3: number;
  temperatureC: number;
  humidityPct: number;
}

export interface SensorHistoryResponse {
  data: {
    stationCode: string;
    from: string;
    to: string;
    intervalMinutes: number;
    measurements: SensorHistoryPoint[];
  };
  metadata: {
    count: number;
    source: 'SIMULATION';
    simulationModel: string;
  };
}

export type SensorEventSeverity = 'INFO' | 'CAUTION' | 'WARNING' | 'CRITICAL';

export type SensorEventStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

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
  severity: SensorEventSeverity;
  status: SensorEventStatus;
  title: string;
  detail: string;
  occurredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgmentNote: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  source: 'DERIVED_SIMULATION';
}

export interface SensorEventsResponse {
  data: SensorEvent[];
  metadata: {
    count: number;
    sensorCode: string;
    source: 'DERIVED_SIMULATION';
  };
}
