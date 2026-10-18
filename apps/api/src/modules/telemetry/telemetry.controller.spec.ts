import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TelemetryController } from './telemetry.controller';
import type { MqttTelemetryClient } from './mqtt-telemetry.client';
import type { TelemetryPayloadV1 } from './telemetry-contract';
import type { TelemetryService } from './telemetry.service';

function createPayload(): TelemetryPayloadV1 {
  return {
    schemaVersion: 1,
    messageId: 'controller-test-message',
    stationCode: 'BDG-AQ-001',
    observedAt: '2026-10-17T14:30:00.000Z',
    measurements: {
      pm25UgM3: 35.4,
      pm10UgM3: 51.8,
      coPpm: 0.9,
      co2Ppm: 525,
      no2Ppb: 31,
      so2Ppb: 6,
      o3Ppb: 20,
      temperatureC: 27.8,
      humidityPct: 70.5,
      pressureHpa: 941.8,
    },
    device: {
      status: 'ONLINE',
      batteryVoltage: 4.07,
      rssiDbm: -65,
      network: 'LTE',
      firmware: '1.0.0',
    },
  };
}

describe('TelemetryController', () => {
  it('returns MQTT connection status', () => {
    const telemetryService = {
      getStationCount: vi.fn().mockReturnValue(2),
    } as unknown as TelemetryService;

    const mqttClient = {
      isEnabled: vi.fn().mockReturnValue(true),
      isConnected: vi.fn().mockReturnValue(true),
    } as unknown as MqttTelemetryClient;

    const controller = new TelemetryController(telemetryService, mqttClient);

    expect(controller.getStatus()).toEqual({
      data: {
        enabled: true,
        connected: true,
        stationCount: 2,
      },
    });
  });

  it('returns latest telemetry', () => {
    const payload = createPayload();

    const telemetryService = {
      getLatest: vi.fn().mockReturnValue(payload),
    } as unknown as TelemetryService;

    const controller = new TelemetryController(
      telemetryService,
      {} as MqttTelemetryClient,
    );

    expect(controller.getLatest('bdg-aq-001')).toEqual({
      data: payload,
    });
  });

  it('throws for unavailable telemetry', () => {
    const telemetryService = {
      getLatest: vi.fn().mockReturnValue(undefined),
    } as unknown as TelemetryService;

    const controller = new TelemetryController(
      telemetryService,
      {} as MqttTelemetryClient,
    );

    expect(() => controller.getLatest('BDG-AQ-001')).toThrow(NotFoundException);
  });
});
