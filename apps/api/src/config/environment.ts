export interface ApplicationEnvironment {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  frontendUrl: string;
}

const supportedNodeEnvironments = [
  'development',
  'test',
  'production',
] as const;

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

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ApplicationEnvironment {
  const nodeEnv = parseNodeEnvironment(source.NODE_ENV);

  return {
    nodeEnv,
    port: parsePort(source.PORT),
    databaseUrl: parseDatabaseUrl(source.DATABASE_URL, nodeEnv),
    frontendUrl: parseFrontendUrl(source.FRONTEND_URL, nodeEnv),
  };
}
