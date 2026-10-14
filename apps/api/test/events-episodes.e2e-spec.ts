import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../src/database/prisma.service';
import { EventsService } from '../src/modules/events/events.service';
import type { SensorsService } from '../src/modules/sensors/sensors.service';
import type {
  SensorMeasurement,
  SensorStation,
} from '../src/modules/sensors/types/sensor.types';

const databaseName = 'event-episodes-integration.db';
const databaseUrl = `file:./prisma/${databaseName}`;
const databasePath = join(process.cwd(), 'prisma', databaseName);

const databaseFiles = [
  databasePath,
  `${databasePath}-journal`,
  `${databasePath}-shm`,
  `${databasePath}-wal`,
];

function removeDatabaseFiles(): void {
  for (const file of databaseFiles) {
    if (existsSync(file)) {
      rmSync(file);
    }
  }
}

function createMeasurement(
  station: SensorStation,
  observedAt: string,
): SensorMeasurement {
  return {
    stationCode: station.code,
    observedAt,
    source: 'SIMULATION',
    simulationModel: 'EVENT-EPISODE-INTEGRATION',
    measurements: {
      pm25UgM3: 42,
      pm10UgM3: 58,
      coPpm: 0.8,
      co2Ppm: 510,
      no2Ppb: 28,
      so2Ppb: 5,
      o3Ppb: 18,
      temperatureC: 27,
      humidityPct: 72,
      pressureHpa: 940,
    },
    device: {
      status: station.status,
      batteryVoltage: 4.1,
      rssiDbm: -70,
      network: 'LTE',
      firmware: station.firmware,
    },
    quality: {
      score: 90,
      label: 'GOOD',
    },
  };
}

describe('Event episodes SQLite integration', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  let prisma: PrismaService;
  let service: EventsService;

  let stationStatus: SensorStation['status'] = 'WARNING';

  let observedAt = '2026-10-14T11:00:00.000Z';

  const station: SensorStation = {
    code: 'TEST-AQ-001',
    name: 'Integration Station',
    city: 'Bandung',
    province: 'Jawa Barat',
    timezone: 'Asia/Jakarta',
    profile: 'ROADSIDE',
    status: 'WARNING',
    location: {
      latitude: -6.9,
      longitude: 107.6,
      elevationM: 700,
    },
    firmware: '1.0.0',
    isSimulated: true,
    installedAt: '2026-09-01T02:00:00.000Z',
    calibrationAt: '2026-10-01T02:00:00.000Z',
  };

  const sensors = {
    findAll: (): SensorStation[] => [
      {
        ...station,
        status: stationStatus,
      },
    ],

    findByCode: (code: string): SensorStation => {
      if (code !== station.code) {
        throw new Error(`Unexpected sensor code: ${code}`);
      }

      return {
        ...station,
        status: stationStatus,
      };
    },

    getLatestMeasurement: (code: string): SensorMeasurement => {
      const currentStation = sensors.findByCode(code);

      return createMeasurement(currentStation, observedAt);
    },
  } as unknown as SensorsService;

  beforeAll(() => {
    removeDatabaseFiles();

    process.env.DATABASE_URL = databaseUrl;

    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: 'pipe',
    });

    prisma = new PrismaService();
    service = new EventsService(sensors, prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    removeDatabaseFiles();
  });

  it('persists recovery and recurrence as separate episodes', async () => {
    const firstReference = new Date('2026-10-14T11:00:00.000Z');

    const firstRead = await service.findBySensorCode(
      station.code,
      firstReference,
    );

    expect(firstRead).toHaveLength(1);
    expect(firstRead[0]).toMatchObject({
      conditionKey: 'TEST-AQ-001:AIR_QUALITY_ADVISORY',
      episodeNumber: 1,
      status: 'ACTIVE',
      occurredAt: '2026-10-14T11:00:00.000Z',
      lastObservedAt: '2026-10-14T11:00:00.000Z',
      clearedAt: null,
    });

    const episodeOneId = firstRead[0].id;

    observedAt = '2026-10-14T11:05:00.000Z';

    const repeatedRead = await service.findBySensorCode(
      station.code,
      new Date('2026-10-14T11:05:00.000Z'),
    );

    expect(repeatedRead).toHaveLength(1);
    expect(repeatedRead[0].id).toBe(episodeOneId);
    expect(repeatedRead[0].occurredAt).toBe('2026-10-14T11:00:00.000Z');
    expect(repeatedRead[0].lastObservedAt).toBe('2026-10-14T11:05:00.000Z');

    await service.resolve(episodeOneId, {
      operator: 'integration-operator',
      note: 'Verified during test',
    });

    observedAt = '2026-10-14T11:10:00.000Z';

    const stillActive = await service.findBySensorCode(
      station.code,
      new Date('2026-10-14T11:10:00.000Z'),
    );

    expect(stillActive).toHaveLength(1);
    expect(stillActive[0]).toMatchObject({
      id: episodeOneId,
      episodeNumber: 1,
      status: 'RESOLVED',
      clearedAt: null,
      resolvedBy: 'integration-operator',
      resolutionNote: 'Verified during test',
      lastObservedAt: '2026-10-14T11:10:00.000Z',
    });

    stationStatus = 'ONLINE';
    observedAt = '2026-10-14T11:15:00.000Z';

    const recovered = await service.findBySensorCode(
      station.code,
      new Date('2026-10-14T11:15:00.000Z'),
    );

    expect(recovered).toHaveLength(1);
    expect(recovered[0].id).toBe(episodeOneId);
    expect(recovered[0].clearedAt).not.toBeNull();
    expect(recovered[0].resolvedBy).toBe('integration-operator');
    expect(recovered[0].resolutionNote).toBe('Verified during test');

    stationStatus = 'WARNING';
    observedAt = '2026-10-14T11:20:00.000Z';

    const recurring = await service.findBySensorCode(
      station.code,
      new Date('2026-10-14T11:20:00.000Z'),
    );

    expect(recurring).toHaveLength(2);

    const episodeTwo = recurring.find((event) => event.episodeNumber === 2);

    const episodeOne = recurring.find((event) => event.episodeNumber === 1);

    expect(episodeTwo).toBeDefined();
    expect(episodeOne).toBeDefined();

    expect(episodeTwo?.id).not.toBe(episodeOneId);
    expect(episodeTwo).toMatchObject({
      conditionKey: 'TEST-AQ-001:AIR_QUALITY_ADVISORY',
      episodeNumber: 2,
      status: 'ACTIVE',
      occurredAt: '2026-10-14T11:20:00.000Z',
      lastObservedAt: '2026-10-14T11:20:00.000Z',
      clearedAt: null,
    });

    expect(episodeOne).toMatchObject({
      id: episodeOneId,
      episodeNumber: 1,
      status: 'RESOLVED',
      resolvedBy: 'integration-operator',
      resolutionNote: 'Verified during test',
    });

    await expect(
      prisma.alertEvent.create({
        data: {
          id: 'duplicate-episode',
          fingerprint: 'TEST-AQ-001:AIR_QUALITY_ADVISORY:duplicate',
          conditionKey: 'TEST-AQ-001:AIR_QUALITY_ADVISORY',
          episodeNumber: 2,
          sensorCode: station.code,
          type: 'AIR_QUALITY_ADVISORY',
          severity: 'WARNING',
          status: 'ACTIVE',
          title: 'Duplicate episode',
          detail: 'Unique constraint test',
          occurredAt: new Date('2026-10-14T11:20:00.000Z'),
          lastObservedAt: new Date('2026-10-14T11:20:00.000Z'),
          source: 'DERIVED_SIMULATION',
        },
      }),
    ).rejects.toBeDefined();

    const stored = await prisma.alertEvent.findMany({
      where: {
        conditionKey: 'TEST-AQ-001:AIR_QUALITY_ADVISORY',
      },
      orderBy: {
        episodeNumber: 'asc',
      },
    });

    expect(stored).toHaveLength(2);
  }, 30_000);
});
