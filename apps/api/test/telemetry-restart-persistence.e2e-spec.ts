import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../src/database/prisma.service';
import { PrismaTelemetryRepository } from '../src/modules/telemetry/prisma-telemetry.repository';
import { TelemetryService } from '../src/modules/telemetry/telemetry.service';
import type { TelemetryPayloadV1 } from '../src/modules/telemetry/telemetry-contract';

const databaseName = 'telemetry-restart-persistence.db';
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

function payload(): TelemetryPayloadV1 {
  return {
    schemaVersion: 1,
    messageId: 'restart-persistence-001',
    stationCode: 'BDG-AQ-001',
    observedAt: '2026-10-21T03:30:00.000Z',
    measurements: {
      pm25UgM3: 34.8,
      pm10UgM3: 49.6,
      coPpm: 0.7,
      co2Ppm: 515,
      no2Ppb: 29,
      so2Ppb: 5,
      o3Ppb: 17,
      temperatureC: 27.3,
      humidityPct: 72.1,
      pressureHpa: 941.9,
    },
    device: {
      status: 'ONLINE',
      batteryVoltage: 4.06,
      rssiDbm: -64,
      network: 'LTE',
      firmware: '1.1.0',
    },
  };
}

function encode(value: TelemetryPayloadV1): Buffer {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

describe('Telemetry restart persistence integration', () => {
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

  it('recovers latest telemetry from SQLite after service recreation', async () => {
    const expected = payload();
    const firstService = new TelemetryService(repository);

    await expect(
      firstService.ingest(
        'airscope/v1/stations/BDG-AQ-001/telemetry',
        encode(expected),
      ),
    ).resolves.toMatchObject({ status: 'ACCEPTED' });

    expect(firstService.getStationCount()).toBe(1);

    // A new service instance has an empty process cache, which models an API restart.
    const restartedService = new TelemetryService(repository);
    expect(restartedService.getStationCount()).toBe(0);

    await expect(restartedService.getLatest('bdg-aq-001')).resolves.toEqual(
      expected,
    );
    expect(restartedService.getStationCount()).toBe(1);
    expect(restartedService.hasProcessedMessage(expected.messageId)).toBe(true);

    const storedCount = await prisma.telemetryMeasurement.count();
    expect(storedCount).toBe(1);
  }, 30_000);
});
