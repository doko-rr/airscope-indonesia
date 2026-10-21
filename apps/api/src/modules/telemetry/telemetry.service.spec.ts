import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from 'vitest';
import type { TelemetryPayloadV1 } from './telemetry-contract';
import type {
  PersistedTelemetryRecord,
  TelemetryRepository,
} from './telemetry.repository';
import {
  TelemetryService,
  TelemetryTopicError,
  TelemetryValidationError,
} from './telemetry.service';

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

function record(payload: TelemetryPayloadV1): PersistedTelemetryRecord {
  return {
    ...payload,
    id: 'telemetry-1',
    source: 'MQTT',
    createdAt: '2026-10-17T14:00:01.000Z',
  };
}

describe('TelemetryService', () => {
  let service: TelemetryService;
  let repository: TelemetryRepository;
  let persist: MockedFunction<TelemetryRepository['persist']>;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    persist = vi.fn<TelemetryRepository['persist']>(async (input) => ({
      status: 'CREATED' as const,
      record: {
        ...input,
        id: 'telemetry-1',
        createdAt: new Date().toISOString(),
      },
    }));
    repository = {
      persist,
      findLatest: vi.fn(async () => null),
      findHistory: vi.fn(async () => []),
    };
    service = new TelemetryService(repository);
  });

  afterEach(() => vi.restoreAllMocks());

  it('persists before accepting valid telemetry', async () => {
    const payload = createPayload();
    const result = await service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );

    expect(persist).toHaveBeenCalledWith({ ...payload, source: 'MQTT' });
    expect(result).toEqual({ status: 'ACCEPTED', payload });
    expect(await service.getLatest('BDG-AQ-001')).toEqual(payload);
  });

  it('normalizes station code lookup', async () => {
    const payload = createPayload();
    await service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );
    expect(await service.getLatest(' bdg-aq-001 ')).toEqual(payload);
  });

  it('returns duplicate without replacing cache', async () => {
    const payload = createPayload();
    persist.mockResolvedValueOnce({
      status: 'DUPLICATE',
      record: record(payload),
    });
    const result = await service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );
    expect(result.status).toBe('DUPLICATE');
    expect(await service.getLatest(payload.stationCode)).toBeUndefined();
    expect(service.hasProcessedMessage(payload.messageId)).toBe(true);
  });

  it('rejects topic and payload station mismatch before persistence', async () => {
    const payload = createPayload();
    await expect(
      service.ingest(
        'airscope/v1/stations/JKT-AQ-001/telemetry',
        encode(payload),
      ),
    ).rejects.toThrow(
      'Telemetry topic station code does not match payload station code.',
    );
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects an unexpected topic before persistence', async () => {
    const payload = createPayload();
    await expect(
      service.ingest('airscope/v1/stations/BDG-AQ-001/status', encode(payload)),
    ).rejects.toThrow(TelemetryTopicError);
    expect(persist).not.toHaveBeenCalled();
  });

  it('propagates validation failures before persistence', async () => {
    const payload = { ...createPayload(), schemaVersion: 2 };
    await expect(
      service.ingest(
        'airscope/v1/stations/BDG-AQ-001/telemetry',
        Buffer.from(JSON.stringify(payload)),
      ),
    ).rejects.toThrow(TelemetryValidationError);
    expect(persist).not.toHaveBeenCalled();
  });

  it('persists stale telemetry without replacing latest cache', async () => {
    const latest = createPayload();
    const older = createPayload({
      messageId: 'BDG-AQ-001-20261017T135500Z',
      observedAt: '2026-10-17T13:55:00.000Z',
    });
    await service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(latest),
    );
    const result = await service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(older),
    );
    expect(result.status).toBe('STALE');
    expect(persist).toHaveBeenCalledTimes(2);
    expect(await service.getLatest('BDG-AQ-001')).toEqual(latest);
  });

  it('replaces latest cache with a newer persisted observation', async () => {
    const first = createPayload();
    const latest = createPayload({
      messageId: 'BDG-AQ-001-20261017T140500Z',
      observedAt: '2026-10-17T14:05:00.000Z',
    });
    await service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(first),
    );
    const result = await service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(latest),
    );
    expect(result.status).toBe('ACCEPTED');
    expect(await service.getLatest('BDG-AQ-001')).toEqual(latest);
  });

  it('does not mutate cache when persistence fails', async () => {
    const payload = createPayload();
    persist.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      service.ingest(
        'airscope/v1/stations/BDG-AQ-001/telemetry',
        encode(payload),
      ),
    ).rejects.toThrow('database unavailable');
    expect(await service.getLatest(payload.stationCode)).toBeUndefined();
    expect(service.hasProcessedMessage(payload.messageId)).toBe(false);
  });

  it('supports a custom topic prefix', async () => {
    const payload = createPayload();
    const result = await service.ingest(
      'demo/v2/stations/BDG-AQ-001/telemetry',
      encode(payload),
      'demo/v2',
    );
    expect(result.status).toBe('ACCEPTED');
  });

  it('loads latest telemetry from persistence on cache miss', async () => {
    const payload = createPayload();
    repository.findLatest = vi.fn(async () => record(payload));

    await expect(service.getLatest('bdg-aq-001')).resolves.toEqual(payload);
    expect(repository.findLatest).toHaveBeenCalledWith('BDG-AQ-001');

    await service.getLatest('BDG-AQ-001');
    expect(repository.findLatest).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when cache and persistence are empty', async () => {
    await expect(service.getLatest('BDG-AQ-001')).resolves.toBeUndefined();
  });

  it('clears in-memory telemetry state without deleting persistence', async () => {
    const payload = createPayload();
    await service.ingest(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      encode(payload),
    );
    service.clear();
    expect(await service.getLatest('BDG-AQ-001')).toBeUndefined();
    expect(service.hasProcessedMessage(payload.messageId)).toBe(false);
    expect(service.getStationCount()).toBe(0);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
