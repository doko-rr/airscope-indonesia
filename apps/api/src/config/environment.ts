export interface ApplicationEnvironment {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  frontendUrl: string;
  mqttEnabled: boolean;
  mqttUrl: string;
  mqttClientId: string;
  mqttTopicPrefix: string;
}

const supportedNodeEnvironments = [
  'development',
  'test',
  'production',
] as const;

const mqttClientIdPattern = /^[a-zA-Z0-9._:-]{1,128}$/;

const mqttTopicSegmentPattern = /^[a-zA-Z0-9._-]+$/;

function parseNodeEnvironment(
  value: string | undefined,
): ApplicationEnvironment['nodeEnv'] {
  const normalized = value ?? 'development';

  if (
    supportedNodeEnvironments.includes(
      normalized as ApplicationEnvironment['nodeEnv'],
    )
  ) {
    return normalized as ApplicationEnvironment['nodeEnv'];
  }

  throw new Error(
    `NODE_ENV must be one of: ${supportedNodeEnvironments.join(', ')}.`,
  );
}

function parsePort(value: string | undefined): number {
  const normalized = value ?? '4000';
  const port = Number(normalized);

  if (Number.isInteger(port) === false || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseDatabaseUrl(
  value: string | undefined,
  nodeEnv: ApplicationEnvironment['nodeEnv'],
): string {
  const normalized =
    value?.trim() || (nodeEnv === 'production' ? '' : 'file:./prisma/dev.db');

  if (!normalized) {
    throw new Error('DATABASE_URL is required in production.');
  }

  if (normalized.startsWith('file:') === false) {
    throw new Error(
      'DATABASE_URL must use a file: URL while AirScope uses SQLite.',
    );
  }

  return normalized;
}

function parseFrontendUrl(
  value: string | undefined,
  nodeEnv: ApplicationEnvironment['nodeEnv'],
): string {
  const normalized =
    value?.trim() || (nodeEnv === 'production' ? '' : 'http://localhost:3000');

  if (!normalized) {
    throw new Error('FRONTEND_URL is required in production.');
  }

  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    throw new Error('FRONTEND_URL must be a valid absolute URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('FRONTEND_URL must use http or https.');
  }

  return url.origin;
}

function parseMqttEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? 'false';

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error('MQTT_ENABLED must be true or false.');
}

function parseMqttUrl(value: string | undefined, enabled: boolean): string {
  const normalized = value?.trim();

  if (!normalized) {
    if (enabled) {
      throw new Error('MQTT_URL is required when MQTT is enabled.');
    }

    return 'mqtt://localhost:1883';
  }

  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    throw new Error('MQTT_URL must be a valid absolute URL.');
  }

  if (url.protocol !== 'mqtt:' && url.protocol !== 'mqtts:') {
    throw new Error('MQTT_URL must use mqtt or mqtts.');
  }

  if (!url.hostname) {
    throw new Error('MQTT_URL must include a hostname.');
  }

  if ((url.pathname !== '' && url.pathname !== '/') || url.search || url.hash) {
    throw new Error('MQTT_URL must not contain a path, query, or fragment.');
  }

  return normalized.replace(/\/$/, '');
}

function parseMqttClientId(value: string | undefined): string {
  const normalized = value?.trim() || 'airscope-api';

  if (mqttClientIdPattern.test(normalized) === false) {
    throw new Error('MQTT_CLIENT_ID has an invalid format.');
  }

  return normalized;
}

function parseMqttTopicPrefix(value: string | undefined): string {
  const normalized = (value?.trim() || 'airscope/v1').replace(/^\/+|\/+$/g, '');

  const segments = normalized.split('/');

  if (
    normalized.length === 0 ||
    segments.some((segment) => mqttTopicSegmentPattern.test(segment) === false)
  ) {
    throw new Error('MQTT_TOPIC_PREFIX has an invalid format.');
  }

  return normalized;
}

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ApplicationEnvironment {
  const nodeEnv = parseNodeEnvironment(source.NODE_ENV);

  const mqttEnabled = parseMqttEnabled(source.MQTT_ENABLED);

  return {
    nodeEnv,
    port: parsePort(source.PORT),
    databaseUrl: parseDatabaseUrl(source.DATABASE_URL, nodeEnv),
    frontendUrl: parseFrontendUrl(source.FRONTEND_URL, nodeEnv),
    mqttEnabled,
    mqttUrl: parseMqttUrl(source.MQTT_URL, mqttEnabled),
    mqttClientId: parseMqttClientId(source.MQTT_CLIENT_ID),
    mqttTopicPrefix: parseMqttTopicPrefix(source.MQTT_TOPIC_PREFIX),
  };
}
