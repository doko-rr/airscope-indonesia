import { describe, expect, it } from 'vitest';
import {
  buildTelemetrySubscription,
  buildTelemetryTopic,
  parseTelemetryTopic,
} from './telemetry-topic';

describe('telemetry MQTT topic convention', () => {
  it('builds a telemetry topic', () => {
    expect(buildTelemetryTopic('BDG-AQ-001')).toBe(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
    );
  });

  it('normalizes a station code', () => {
    expect(buildTelemetryTopic(' bdg-aq-001 ')).toBe(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
    );
  });

  it('builds a wildcard subscription', () => {
    expect(buildTelemetrySubscription()).toBe(
      'airscope/v1/stations/+/telemetry',
    );
  });

  it('supports a custom topic prefix', () => {
    expect(buildTelemetryTopic('BDG-AQ-001', '/demo/v2/')).toBe(
      'demo/v2/stations/BDG-AQ-001/telemetry',
    );
  });

  it('parses a valid telemetry topic', () => {
    expect(
      parseTelemetryTopic('airscope/v1/stations/BDG-AQ-001/telemetry'),
    ).toEqual({
      prefix: 'airscope/v1',
      stationCode: 'BDG-AQ-001',
      kind: 'telemetry',
    });
  });

  it('rejects a topic with another prefix', () => {
    expect(
      parseTelemetryTopic('other/v1/stations/BDG-AQ-001/telemetry'),
    ).toBeNull();
  });

  it('rejects another message kind', () => {
    expect(
      parseTelemetryTopic('airscope/v1/stations/BDG-AQ-001/status'),
    ).toBeNull();
  });

  it('rejects an invalid station code', () => {
    expect(
      parseTelemetryTopic('airscope/v1/stations/invalid_station/telemetry'),
    ).toBeNull();
  });
});
