export const TELEMETRY_REPOSITORY = Symbol('TELEMETRY_REPOSITORY');

export interface PersistedTelemetryInput {
  messageId: string;
  schemaVersion: number;
  stationCode: string;
  observedAt: string;
  source: 'MQTT';
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
    status: string;
    batteryVoltage: number;
    rssiDbm: number;
    network: string;
    firmware: string;
  };
}

export interface PersistedTelemetryRecord extends PersistedTelemetryInput {
  id: string;
  createdAt: string;
}

export type PersistTelemetryResult =
  | { status: 'CREATED'; record: PersistedTelemetryRecord }
  | { status: 'DUPLICATE'; record: PersistedTelemetryRecord };

export interface TelemetryRepository {
  persist(input: PersistedTelemetryInput): Promise<PersistTelemetryResult>;
  findLatest(stationCode: string): Promise<PersistedTelemetryRecord | null>;
  findHistory(
    stationCode: string,
    from: Date,
    to: Date,
    limit?: number,
  ): Promise<PersistedTelemetryRecord[]>;
}
