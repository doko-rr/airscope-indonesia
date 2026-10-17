const DEFAULT_TOPIC_PREFIX = 'airscope/v1';

const stationCodePattern = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

export interface TelemetryTopic {
  prefix: string;
  stationCode: string;
  kind: 'telemetry';
}

function normalizePrefix(prefix: string): string {
  const normalized = prefix.trim().replace(/^\/+|\/+$/g, '');

  if (normalized.length === 0 || normalized.includes('//')) {
    throw new Error('MQTT topic prefix is invalid.');
  }

  return normalized;
}

function normalizeStationCode(stationCode: string): string {
  const normalized = stationCode.trim().toUpperCase();

  if (stationCodePattern.test(normalized) === false) {
    throw new Error('Station code is invalid.');
  }

  return normalized;
}

export function buildTelemetryTopic(
  stationCode: string,
  prefix = DEFAULT_TOPIC_PREFIX,
): string {
  return [
    normalizePrefix(prefix),
    'stations',
    normalizeStationCode(stationCode),
    'telemetry',
  ].join('/');
}

export function buildTelemetrySubscription(
  prefix = DEFAULT_TOPIC_PREFIX,
): string {
  return [normalizePrefix(prefix), 'stations', '+', 'telemetry'].join('/');
}

export function parseTelemetryTopic(
  topic: string,
  prefix = DEFAULT_TOPIC_PREFIX,
): TelemetryTopic | null {
  const normalizedPrefix = normalizePrefix(prefix);

  const topicParts = topic.split('/');
  const prefixParts = normalizedPrefix.split('/');

  if (topicParts.length !== prefixParts.length + 3) {
    return null;
  }

  const actualPrefix = topicParts.slice(0, prefixParts.length).join('/');

  if (actualPrefix !== normalizedPrefix) {
    return null;
  }

  const stationsSegment = topicParts[prefixParts.length];

  const stationCode = topicParts[prefixParts.length + 1];

  const kind = topicParts[prefixParts.length + 2];

  if (
    stationsSegment !== 'stations' ||
    kind !== 'telemetry' ||
    stationCodePattern.test(stationCode) === false
  ) {
    return null;
  }

  return {
    prefix: normalizedPrefix,
    stationCode,
    kind: 'telemetry',
  };
}
