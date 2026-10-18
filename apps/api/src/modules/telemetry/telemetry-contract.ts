export const TELEMETRY_SCHEMA_VERSION = 1 as const;

export type TelemetryDeviceStatus =
  'ONLINE' | 'WARNING' | 'OFFLINE' | 'MAINTENANCE';

export interface TelemetryMeasurementsV1 {
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
}

export interface TelemetryDeviceV1 {
  status: TelemetryDeviceStatus;
  batteryVoltage: number;
  rssiDbm: number;
  network: string;
  firmware: string;
}

export interface TelemetryPayloadV1 {
  schemaVersion: typeof TELEMETRY_SCHEMA_VERSION;
  messageId: string;
  stationCode: string;
  observedAt: string;
  measurements: TelemetryMeasurementsV1;
  device: TelemetryDeviceV1;
}

export class TelemetryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelemetryValidationError';
  }
}

const identifierPattern = /^[a-zA-Z0-9._:-]{1,128}$/;

const stationCodePattern = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

const firmwarePattern = /^[a-zA-Z0-9._+-]{1,64}$/;

const networkPattern = /^[a-zA-Z0-9._+-]{1,32}$/;

const supportedDeviceStatuses = new Set<TelemetryDeviceStatus>([
  'ONLINE',
  'WARNING',
  'OFFLINE',
  'MAINTENANCE',
]);

function expectRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TelemetryValidationError(`${field} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, field: string, pattern: RegExp): string {
  if (typeof value !== 'string' || pattern.test(value) === false) {
    throw new TelemetryValidationError(`${field} has an invalid format.`);
  }

  return value;
}

function expectNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    Number.isFinite(value) === false ||
    value < minimum ||
    value > maximum
  ) {
    throw new TelemetryValidationError(
      `${field} must be between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function expectTimestamp(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TelemetryValidationError(
      'observedAt must be an ISO 8601 timestamp.',
    );
  }

  const timestamp = Date.parse(value);

  if (
    Number.isFinite(timestamp) === false ||
    new Date(timestamp).toISOString() !== value
  ) {
    throw new TelemetryValidationError(
      'observedAt must be a canonical UTC ISO 8601 timestamp.',
    );
  }

  return value;
}

function parseMeasurements(value: unknown): TelemetryMeasurementsV1 {
  const input = expectRecord(value, 'measurements');

  return {
    pm25UgM3: expectNumber(input.pm25UgM3, 'measurements.pm25UgM3', 0, 2_000),
    pm10UgM3: expectNumber(input.pm10UgM3, 'measurements.pm10UgM3', 0, 3_000),
    coPpm: expectNumber(input.coPpm, 'measurements.coPpm', 0, 1_000),
    co2Ppm: expectNumber(input.co2Ppm, 'measurements.co2Ppm', 0, 100_000),
    no2Ppb: expectNumber(input.no2Ppb, 'measurements.no2Ppb', 0, 10_000),
    so2Ppb: expectNumber(input.so2Ppb, 'measurements.so2Ppb', 0, 10_000),
    o3Ppb: expectNumber(input.o3Ppb, 'measurements.o3Ppb', 0, 10_000),
    temperatureC: expectNumber(
      input.temperatureC,
      'measurements.temperatureC',
      -50,
      100,
    ),
    humidityPct: expectNumber(
      input.humidityPct,
      'measurements.humidityPct',
      0,
      100,
    ),
    pressureHpa: expectNumber(
      input.pressureHpa,
      'measurements.pressureHpa',
      300,
      1_200,
    ),
  };
}

function parseDevice(value: unknown): TelemetryDeviceV1 {
  const input = expectRecord(value, 'device');

  if (
    typeof input.status !== 'string' ||
    supportedDeviceStatuses.has(input.status as TelemetryDeviceStatus) === false
  ) {
    throw new TelemetryValidationError('device.status is unsupported.');
  }

  return {
    status: input.status as TelemetryDeviceStatus,
    batteryVoltage: expectNumber(
      input.batteryVoltage,
      'device.batteryVoltage',
      0,
      60,
    ),
    rssiDbm: expectNumber(input.rssiDbm, 'device.rssiDbm', -200, 0),
    network: expectString(input.network, 'device.network', networkPattern),
    firmware: expectString(input.firmware, 'device.firmware', firmwarePattern),
  };
}

export function parseTelemetryPayloadV1(value: unknown): TelemetryPayloadV1 {
  const input = expectRecord(value, 'payload');

  if (input.schemaVersion !== TELEMETRY_SCHEMA_VERSION) {
    throw new TelemetryValidationError(
      `schemaVersion must be ${TELEMETRY_SCHEMA_VERSION}.`,
    );
  }

  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    messageId: expectString(input.messageId, 'messageId', identifierPattern),
    stationCode: expectString(
      input.stationCode,
      'stationCode',
      stationCodePattern,
    ),
    observedAt: expectTimestamp(input.observedAt),
    measurements: parseMeasurements(input.measurements),
    device: parseDevice(input.device),
  };
}

export function decodeTelemetryPayloadV1(
  value: Buffer | string,
): TelemetryPayloadV1 {
  const text = Buffer.isBuffer(value) ? value.toString('utf8') : value;

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TelemetryValidationError(
      'Telemetry payload must contain valid JSON.',
    );
  }

  return parseTelemetryPayloadV1(parsed);
}
