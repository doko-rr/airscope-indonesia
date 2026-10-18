import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { connect, type MqttClient } from 'mqtt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MqttTelemetryClient } from './mqtt-telemetry.client';
import type { TelemetryService } from './telemetry.service';

vi.mock('mqtt', () => ({
  connect: vi.fn(),
}));

interface FakeMqttClient extends EventEmitter {
  connected: boolean;
  subscribeAsync: ReturnType<typeof vi.fn>;
  endAsync: ReturnType<typeof vi.fn>;
}

function createFakeClient(): FakeMqttClient {
  const client = new EventEmitter() as FakeMqttClient;

  client.connected = false;

  client.subscribeAsync = vi.fn().mockResolvedValue([]);

  client.endAsync = vi.fn().mockResolvedValue(undefined);

  return client;
}

function createTelemetryService() {
  return {
    ingest: vi.fn(),
  } as unknown as TelemetryService;
}

function setMqttEnvironment(enabled: boolean): void {
  process.env.MQTT_ENABLED = enabled ? 'true' : 'false';

  process.env.MQTT_URL = 'mqtt://localhost:1883';

  process.env.MQTT_CLIENT_ID = 'airscope-api-test';

  process.env.MQTT_TOPIC_PREFIX = 'airscope/v1';
}

describe('MqttTelemetryClient', () => {
  const originalEnvironment = {
    MQTT_ENABLED: process.env.MQTT_ENABLED,
    MQTT_URL: process.env.MQTT_URL,
    MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID,
    MQTT_TOPIC_PREFIX: process.env.MQTT_TOPIC_PREFIX,
  };

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    vi.mocked(connect).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();

    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('does not connect when MQTT is disabled', () => {
    setMqttEnvironment(false);

    const client = new MqttTelemetryClient(createTelemetryService());

    client.onModuleInit();

    expect(connect).not.toHaveBeenCalled();
    expect(client.isEnabled()).toBe(false);
    expect(client.isConnected()).toBe(false);
  });

  it('connects with the validated MQTT configuration', () => {
    setMqttEnvironment(true);

    const mqttClient = createFakeClient();

    vi.mocked(connect).mockReturnValue(mqttClient as unknown as MqttClient);

    const client = new MqttTelemetryClient(createTelemetryService());

    client.onModuleInit();

    expect(connect).toHaveBeenCalledWith(
      'mqtt://localhost:1883',
      expect.objectContaining({
        clientId: 'airscope-api-test',
        clean: true,
        reconnectPeriod: 5_000,
        connectTimeout: 10_000,
      }),
    );

    expect(client.isEnabled()).toBe(true);
  });

  it('subscribes after connecting', async () => {
    setMqttEnvironment(true);

    const mqttClient = createFakeClient();

    vi.mocked(connect).mockReturnValue(mqttClient as unknown as MqttClient);

    const client = new MqttTelemetryClient(createTelemetryService());

    client.onModuleInit();

    mqttClient.emit('connect');

    await vi.waitFor(() => {
      expect(mqttClient.subscribeAsync).toHaveBeenCalledWith(
        'airscope/v1/stations/+/telemetry',
        {
          qos: 1,
        },
      );
    });
  });

  it('forwards MQTT messages to the telemetry service', () => {
    setMqttEnvironment(true);

    const mqttClient = createFakeClient();

    const telemetryService = createTelemetryService();

    vi.mocked(connect).mockReturnValue(mqttClient as unknown as MqttClient);

    const client = new MqttTelemetryClient(telemetryService);

    client.onModuleInit();

    const message = Buffer.from('{"schemaVersion":1}');

    mqttClient.emit(
      'message',
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      message,
    );

    expect(telemetryService.ingest).toHaveBeenCalledWith(
      'airscope/v1/stations/BDG-AQ-001/telemetry',
      message,
      'airscope/v1',
    );
  });

  it('does not crash when telemetry ingestion rejects a message', () => {
    setMqttEnvironment(true);

    const mqttClient = createFakeClient();

    const telemetryService = createTelemetryService();

    vi.mocked(telemetryService.ingest).mockImplementation(() => {
      throw new Error('Invalid telemetry payload');
    });

    vi.mocked(connect).mockReturnValue(mqttClient as unknown as MqttClient);

    const client = new MqttTelemetryClient(telemetryService);

    client.onModuleInit();

    expect(() =>
      mqttClient.emit(
        'message',
        'airscope/v1/stations/BDG-AQ-001/telemetry',
        Buffer.from('{}'),
      ),
    ).not.toThrow();
  });

  it('reports the underlying connection state', () => {
    setMqttEnvironment(true);

    const mqttClient = createFakeClient();

    mqttClient.connected = true;

    vi.mocked(connect).mockReturnValue(mqttClient as unknown as MqttClient);

    const client = new MqttTelemetryClient(createTelemetryService());

    client.onModuleInit();

    expect(client.isConnected()).toBe(true);
  });

  it('disconnects gracefully during shutdown', async () => {
    setMqttEnvironment(true);

    const mqttClient = createFakeClient();

    vi.mocked(connect).mockReturnValue(mqttClient as unknown as MqttClient);

    const client = new MqttTelemetryClient(createTelemetryService());

    client.onModuleInit();

    await client.onModuleDestroy();

    expect(mqttClient.endAsync).toHaveBeenCalledTimes(1);

    expect(client.isConnected()).toBe(false);
  });

  it('does nothing during shutdown when MQTT is disabled', async () => {
    setMqttEnvironment(false);

    const client = new MqttTelemetryClient(createTelemetryService());

    client.onModuleInit();

    await expect(client.onModuleDestroy()).resolves.toBeUndefined();
  });
});
