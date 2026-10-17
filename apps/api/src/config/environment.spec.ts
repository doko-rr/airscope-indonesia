import { describe, expect, it } from 'vitest';
import { loadEnvironment } from './environment';

describe('loadEnvironment', () => {
  it('uses safe development defaults', () => {
    expect(loadEnvironment({})).toEqual({
      nodeEnv: 'development',
      port: 4000,
      databaseUrl: 'file:./prisma/dev.db',
      frontendUrl: 'http://localhost:3000',
      mqttEnabled: false,
      mqttUrl: 'mqtt://localhost:1883',
      mqttClientId: 'airscope-api',
      mqttTopicPrefix: 'airscope/v1',
    });
  });

  it('accepts an explicit production configuration', () => {
    expect(
      loadEnvironment({
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL: 'file:./prisma/production.db',
        FRONTEND_URL: 'https://airscope.example.com/',
        MQTT_ENABLED: 'true',
        MQTT_URL: 'mqtts://mqtt.example.com:8883',
        MQTT_CLIENT_ID: 'airscope-api-production',
        MQTT_TOPIC_PREFIX: '/airscope/v1/',
      }),
    ).toEqual({
      nodeEnv: 'production',
      port: 8080,
      databaseUrl: 'file:./prisma/production.db',
      frontendUrl: 'https://airscope.example.com',
      mqttEnabled: true,
      mqttUrl: 'mqtts://mqtt.example.com:8883',
      mqttClientId: 'airscope-api-production',
      mqttTopicPrefix: 'airscope/v1',
    });
  });

  it('requires DATABASE_URL in production', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://airscope.example.com',
      }),
    ).toThrow('DATABASE_URL is required in production.');
  });

  it('requires FRONTEND_URL in production', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'file:./prisma/production.db',
      }),
    ).toThrow('FRONTEND_URL is required in production.');
  });

  it('rejects an invalid port', () => {
    expect(() =>
      loadEnvironment({
        PORT: '70000',
      }),
    ).toThrow('PORT must be an integer between 1 and 65535.');
  });

  it('rejects an unsupported database URL', () => {
    expect(() =>
      loadEnvironment({
        DATABASE_URL: 'postgresql://localhost/airscope',
      }),
    ).toThrow('DATABASE_URL must use a file: URL while AirScope uses SQLite.');
  });

  it('rejects an invalid frontend URL', () => {
    expect(() =>
      loadEnvironment({
        FRONTEND_URL: 'not-a-url',
      }),
    ).toThrow('FRONTEND_URL must be a valid absolute URL.');
  });

  it('accepts MQTT being explicitly disabled', () => {
    expect(
      loadEnvironment({
        MQTT_ENABLED: 'false',
      }).mqttEnabled,
    ).toBe(false);
  });

  it('rejects an invalid MQTT enabled value', () => {
    expect(() =>
      loadEnvironment({
        MQTT_ENABLED: 'yes',
      }),
    ).toThrow('MQTT_ENABLED must be true or false.');
  });

  it('requires MQTT_URL when MQTT is enabled', () => {
    expect(() =>
      loadEnvironment({
        MQTT_ENABLED: 'true',
      }),
    ).toThrow('MQTT_URL is required when MQTT is enabled.');
  });

  it('rejects a non-MQTT URL protocol', () => {
    expect(() =>
      loadEnvironment({
        MQTT_ENABLED: 'true',
        MQTT_URL: 'https://mqtt.example.com',
      }),
    ).toThrow('MQTT_URL must use mqtt or mqtts.');
  });

  it('normalizes a MQTT URL with a trailing slash', () => {
    expect(
      loadEnvironment({
        MQTT_ENABLED: 'true',
        MQTT_URL: 'mqtt://localhost:1883/',
      }).mqttUrl,
    ).toBe('mqtt://localhost:1883');
  });

  it('rejects a MQTT URL containing a path', () => {
    expect(() =>
      loadEnvironment({
        MQTT_ENABLED: 'true',
        MQTT_URL: 'mqtt://localhost:1883/broker',
      }),
    ).toThrow('MQTT_URL must not contain a path, query, or fragment.');
  });

  it('rejects an invalid MQTT client ID', () => {
    expect(() =>
      loadEnvironment({
        MQTT_CLIENT_ID: 'invalid client id',
      }),
    ).toThrow('MQTT_CLIENT_ID has an invalid format.');
  });

  it('normalizes the MQTT topic prefix', () => {
    expect(
      loadEnvironment({
        MQTT_TOPIC_PREFIX: '/demo/v2/',
      }).mqttTopicPrefix,
    ).toBe('demo/v2');
  });

  it('rejects MQTT wildcards in the topic prefix', () => {
    expect(() =>
      loadEnvironment({
        MQTT_TOPIC_PREFIX: 'airscope/+/v1',
      }),
    ).toThrow('MQTT_TOPIC_PREFIX has an invalid format.');
  });
});
