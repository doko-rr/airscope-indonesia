import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TelemetryService,
  TelemetryTopicError,
  TelemetryValidationError,
} from './telemetry.service';
import type { TelemetryPayloadV1 } from './telemetry-contract';

function createPayload(
  overrides: Partial<TelemetryPayloadV1> = {},
): TelemetryPayloadV1 {
  return {
    schemaVersion: 1,
    messageId: 'BDG-AQ-001-20261017T140000Z',
    stationCode: 'BDG-AQ-001',
    observedAt: '2026-10-17T14:00:00.000Z',
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
    ...overrides,
  };
}

function encode(payload: TelemetryPayloadV1): Buffer {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    service = new TelemetryService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts and stores valid telemetry', () => {
    const payload = createPayload();

    const result = service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );

    expect(result).toEqual({
      status: 'ACCEPTED',
      payload,
    });

    expect(service.getLatest('BDG-AQ-001')).toEqual(payload);

    expect(service.getStationCount()).toBe(1);
  });

  it('normalizes station code lookup', () => {
    const payload = createPayload();

    service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );

    expect(service.getLatest(' bdg-aq-001 ')).toEqual(payload);
  });

  it('returns duplicate for an existing message ID', () => {
    const payload = createPayload();

    service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );

    const duplicate = service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );

    expect(duplicate.status).toBe('DUPLICATE');

    expect(service.getStationCount()).toBe(1);
  });

  it('rejects topic and payload station mismatch', () => {
    const payload = createPayload();

    expect(() =>
      service.ingest(
        'airscope/v1/stations/JKT-AQ-001/telemetry',
        encode(payload),
      ),
    ).toThrow(
      'Telemetry topic station code does not match payload station code.',
    );
  });

  it('rejects an unexpected topic', () => {
    const payload = createPayload();

    expect(() =>
      service.ingest('airscope/v1/stations/BDG-AQ-001/status', encode(payload)),
    ).toThrow(TelemetryTopicError);
  });

  it('propagates payload validation failures', () => {
    const payload = {
      ...createPayload(),
      schemaVersion: 2,
    };

    expect(() =>
      service.ingest(
        'airscope/v1/stations/BDG-AQ-001/telemetry',
        Buffer.from(JSON.stringify(payload)),
      ),
    ).toThrow(TelemetryValidationError);
  });

  it('does not replace latest telemetry with an older observation', () => {
    const latest = createPayload();

    const older = createPayload({
      messageId: 'BDG-AQ-001-20261017T135500Z',
      observedAt: '2026-10-17T13:55:00.000Z',
    });

    service.ingest('airscope/v1/stations/BDG-AQ-001/telemetry', encode(latest));

    const result = service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(older),
    );

    expect(result.status).toBe('STALE');

    expect(service.getLatest('BDG-AQ-001')).toEqual(latest);

    expect(service.hasProcessedMessage(older.messageId)).toBe(true);
  });

  it('replaces latest telemetry with a newer observation', () => {
    const first = createPayload();

    const latest = createPayload({
      messageId: 'BDG-AQ-001-20261017T140500Z',
      observedAt: '2026-10-17T14:05:00.000Z',
    });

    service.ingest('airscope/v1/stations/BDG-AQ-001/telemetry', encode(first));

    const result = service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(latest),
    );

    expect(result.status).toBe('ACCEPTED');

    expect(service.getLatest('BDG-AQ-001')).toEqual(latest);
  });

  it('supports a custom topic prefix', () => {
    const payload = createPayload();

    const result = service.ingest(
      'demo/v2/stations/BDG-AQ-001/telemetry',
      encode(payload),
      'demo/v2',
    );

    expect(result.status).toBe('ACCEPTED');
  });

  it('clears in-memory telemetry state', () => {
    const payload = createPayload();

    service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );

    service.clear();

    expect(service.getLatest('BDG-AQ-001')).toBeUndefined();

    expect(service.hasProcessedMessage(payload.messageId)).toBe(false);

    expect(service.getStationCount()).toBe(0);
  });
});
