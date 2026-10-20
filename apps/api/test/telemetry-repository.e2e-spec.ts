import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../src/database/prisma.service';
import { PrismaTelemetryRepository } from '../src/modules/telemetry/prisma-telemetry.repository';
import type { PersistedTelemetryInput } from '../src/modules/telemetry/telemetry.repository';

const databaseName = 'telemetry-repository-integration.db';
const databaseUrl = `file:./prisma/${databaseName}`;
const databasePath = join(process.cwd(), 'prisma', databaseName);
const databaseFiles = [
  databasePath,
  `${databasePath}-journal`,
  `${databasePath}-shm`,
  `${databasePath}-wal`,
];

function cleanup(): void {
  for (const file of databaseFiles) {
    if (existsSync(file)) rmSync(file);
  }
}

function telemetry(
  messageId: string,
  observedAt: string,
): PersistedTelemetryInput {
  return {
    messageId,
    schemaVersion: 1,
    stationCode: 'BDG-AQ-001',
    observedAt,
    source: 'MQTT',
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
  };
}

describe('PrismaTelemetryRepository integration', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let repository: PrismaTelemetryRepository;

  beforeAll(() => {
    cleanup();
    process.env.DATABASE_URL = databaseUrl;
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
    prisma = new PrismaService();
    repository = new PrismaTelemetryRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    cleanup();
  });

  it('persists, deduplicates, and queries telemetry', async () => {
    const older = telemetry('repository-001', '2026-10-20T02:00:00.000Z');
    const newer = telemetry('repository-002', '2026-10-20T02:05:00.000Z');

    await expect(repository.persist(older)).resolves.toMatchObject({
      status: 'CREATED',
    });
    await expect(repository.persist(older)).resolves.toMatchObject({
      status: 'DUPLICATE',
    });
    await expect(repository.persist(newer)).resolves.toMatchObject({
      status: 'CREATED',
    });

    const latest = await repository.findLatest('BDG-AQ-001');
    expect(latest?.messageId).toBe('repository-002');

    const history = await repository.findHistory(
      'BDG-AQ-001',
      new Date('2026-10-20T01:59:00.000Z'),
      new Date('2026-10-20T02:06:00.000Z'),
    );
    expect(history.map((item) => item.messageId)).toEqual([
      'repository-001',
      'repository-002',
    ]);

    const stored = await prisma.telemetryMeasurement.count();
    expect(stored).toBe(2);
  }, 30_000);
});
