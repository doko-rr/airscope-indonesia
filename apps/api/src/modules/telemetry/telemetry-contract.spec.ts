import { describe, expect, it } from 'vitest';
import {
  decodeTelemetryPayloadV1,
  parseTelemetryPayloadV1,
  TelemetryValidationError,
  type TelemetryPayloadV1,
} from './telemetry-contract';

function createPayload(): TelemetryPayloadV1 {
  return {
    schemaVersion: 1,
    messageId: 'BDG-AQ-001-20261017T120000Z',
    stationCode: 'BDG-AQ-001',
    observedAt: '2026-10-17T12:00:00.000Z',
    measurements: {
      pm25UgM3: 32.5,
      pm10UgM3: 48.2,
      coPpm: 0.8,
      co2Ppm: 510,
      no2Ppb: 28,
      so2Ppb: 5,
      o3Ppb: 18,
      temperatureC: 27.4,
      humidityPct: 71.2,
      pressureHpa: 942.1,
    },
    device: {
      status: 'ONLINE',
      batteryVoltage: 4.08,
      rssiDbm: -67,
      network: 'LTE',
      firmware: '1.0.0',
    },
  };
}

describe('TelemetryPayloadV1', () => {
  it('accepts a valid telemetry payload', () => {
    const payload = createPayload();

    expect(parseTelemetryPayloadV1(payload)).toEqual(payload);
  });

  it('decodes a valid JSON buffer', () => {
    const payload = createPayload();

    expect(
      decodeTelemetryPayloadV1(Buffer.from(JSON.stringify(payload), 'utf8')),
    ).toEqual(payload);
  });

  it('rejects malformed JSON', () => {
    expect(() => decodeTelemetryPayloadV1(Buffer.from('{invalid'))).toThrow(
      'Telemetry payload must contain valid JSON.',
    );
  });

  it('rejects an unsupported schema version', () => {
    const payload = {
      ...createPayload(),
      schemaVersion: 2,
    };

    expect(() => parseTelemetryPayloadV1(payload)).toThrow(
      'schemaVersion must be 1.',
    );
  });

  it('rejects an invalid station code', () => {
    const payload = {
      ...createPayload(),
      stationCode: 'invalid station',
    };

    expect(() => parseTelemetryPayloadV1(payload)).toThrow(
      'stationCode has an invalid format.',
    );
  });

  it('requires a canonical UTC timestamp', () => {
    const payload = {
      ...createPayload(),
      observedAt: '2026-10-17T19:00:00+07:00',
    };

    expect(() => parseTelemetryPayloadV1(payload)).toThrow(
      'observedAt must be a canonical UTC ISO 8601 timestamp.',
    );
  });

  it('rejects measurements outside the supported range', () => {
    const payload = createPayload();

    payload.measurements.humidityPct = 101;

    expect(() => parseTelemetryPayloadV1(payload)).toThrow(
      'measurements.humidityPct must be between 0 and 100.',
    );
  });

  it('rejects invalid device status', () => {
    const payload = {
      ...createPayload(),
      device: {
        ...createPayload().device,
        status: 'BROKEN',
      },
    };

    expect(() => parseTelemetryPayloadV1(payload)).toThrow(
      'device.status is unsupported.',
    );
  });

  it('throws a dedicated validation error', () => {
    try {
      parseTelemetryPayloadV1(null);
    } catch (error) {
      expect(error).toBeInstanceOf(TelemetryValidationError);

      return;
    }

    throw new Error('Expected telemetry validation to fail.');
  });
});
