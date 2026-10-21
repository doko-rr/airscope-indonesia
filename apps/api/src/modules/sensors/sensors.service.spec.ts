import { describe, expect, it, vi } from 'vitest';
import type { TelemetryPayloadV1 } from '../telemetry/telemetry-contract';
import type { TelemetryService } from '../telemetry/telemetry.service';
import { SensorsService } from './sensors.service';

function createTelemetryService(latest?: TelemetryPayloadV1): TelemetryService {
  return {
    getLatest: vi.fn().mockResolvedValue(latest),
  } as unknown as TelemetryService;
}

function createTelemetry(): TelemetryPayloadV1 {
  return {
    schemaVersion: 1,
    messageId: 'sensor-service-mqtt-001',
    stationCode: 'BDG-AQ-001',
    observedAt: '2026-10-18T00:15:00.000Z',
    measurements: {
      pm25UgM3: 41.5,
      pm10UgM3: 57.2,
      coPpm: 0.9,
      co2Ppm: 530,
      no2Ppb: 34,
      so2Ppb: 7,
      o3Ppb: 19,
      temperatureC: 27.1,
      humidityPct: 73.4,
      pressureHpa: 941.2,
    },
    device: {
      status: 'ONLINE',
      batteryVoltage: 4.05,
      rssiDbm: -63,
      network: 'WIFI',
      firmware: '1.1.0',
    },
  };
}

describe('SensorsService history', () => {
  const service = new SensorsService(createTelemetryService());

  const referenceDate = new Date('2026-10-08T12:34:00.000Z');

  it('generates a deterministic 24-hour hourly series', () => {
    const first = service.getMeasurementHistory(
      'BDG-AQ-001',
      24,
      60,
      referenceDate,
    );

    const second = service.getMeasurementHistory(
      'BDG-AQ-001',
      24,
      60,
      referenceDate,
    );

    expect(first.stationCode).toBe('BDG-AQ-001');

    expect(first.intervalMinutes).toBe(60);

    expect(first.measurements).toHaveLength(25);

    expect(first).toEqual(second);
  });

  it('keeps timestamps ordered at the requested interval', () => {
    const result = service.getMeasurementHistory(
      'BDG-AQ-003',
      2,
      30,
      referenceDate,
    );

    expect(result.measurements).toHaveLength(5);

    for (let index = 1; index < result.measurements.length; index += 1) {
      const previous = new Date(
        result.measurements[index - 1].observedAt,
      ).getTime();

      const current = new Date(result.measurements[index].observedAt).getTime();

      expect(current - previous).toBe(30 * 60 * 1000);
    }
  });

  it('throws for an unknown station', () => {
    expect(() =>
      service.getMeasurementHistory('INVALID', 24, 60, referenceDate),
    ).toThrow('Sensor station INVALID was not found');
  });

  it('uses simulation when MQTT telemetry is unavailable', async () => {
    const fallbackService = new SensorsService(createTelemetryService());

    const measurement =
      await fallbackService.getLatestMeasurement('BDG-AQ-001');

    expect(measurement.source).toBe('SIMULATION');

    expect(measurement.simulationModel).toBe('AIRSIM-DETERMINISTIC-V1');

    expect(measurement.messageId).toBeUndefined();
  });

  it('uses latest MQTT telemetry when available', async () => {
    const telemetry = createTelemetry();

    const mqttService = new SensorsService(createTelemetryService(telemetry));

    const measurement = await mqttService.getLatestMeasurement('bdg-aq-001');

    expect(measurement).toEqual({
      stationCode: 'BDG-AQ-001',
      observedAt: '2026-10-18T00:15:00.000Z',
      source: 'MQTT',
      messageId: 'sensor-service-mqtt-001',
      measurements: telemetry.measurements,
      device: telemetry.device,
      quality: {
        score: 100,
        label: 'GOOD',
      },
    });
  });

  it('does not query telemetry for an unknown station', async () => {
    const telemetryService = createTelemetryService(createTelemetry());

    const mqttService = new SensorsService(telemetryService);

    await expect(mqttService.getLatestMeasurement('UNKNOWN')).rejects.toThrow(
      'Sensor station UNKNOWN was not found',
    );

    expect(telemetryService.getLatest).not.toHaveBeenCalled();
  });
});
