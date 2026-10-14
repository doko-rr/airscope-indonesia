import type { PrismaService } from '../../database/prisma.service';
import { SensorsService } from '../sensors/sensors.service';
import { EventsService } from './events.service';

type StoredRecord = Record<string, any>;

function matches(record: StoredRecord, where: any = {}): boolean {
  if (where.id !== undefined && record.id !== where.id) return false;
  if (where.conditionKey !== undefined) {
    if (
      typeof where.conditionKey === 'object' &&
      where.conditionKey !== null &&
      Array.isArray(where.conditionKey.notIn)
    ) {
      if (where.conditionKey.notIn.includes(record.conditionKey)) return false;
    } else if (record.conditionKey !== where.conditionKey) {
      return false;
    }
  }
  if (
    where.sensorCode?.in &&
    !where.sensorCode.in.includes(record.sensorCode)
  ) {
    return false;
  }
  if (typeof where.status === 'string' && record.status !== where.status) {
    return false;
  }
  if (where.status?.in && !where.status.in.includes(record.status)) {
    return false;
  }
  if (where.clearedAt === null && record.clearedAt !== null) return false;
  return true;
}

function createPrismaMock() {
  const records = new Map<string, StoredRecord>();
  let sequence = 0;

  const alertEvent = {
    findFirst: async ({ where, orderBy }: any = {}) => {
      const found = [...records.values()].filter((record) =>
        matches(record, where),
      );
      if (orderBy?.episodeNumber === 'desc') {
        found.sort((left, right) => right.episodeNumber - left.episodeNumber);
      }
      return found[0] ?? null;
    },
    findUnique: async ({ where }: any) =>
      [...records.values()].find((record) => matches(record, where)) ?? null,
    findMany: async ({ where, orderBy }: any = {}) => {
      const found = [...records.values()].filter((record) =>
        matches(record, where),
      );
      const occurredOrder = Array.isArray(orderBy)
        ? orderBy.find((entry) => entry.occurredAt)?.occurredAt
        : orderBy?.occurredAt;
      if (occurredOrder === 'desc') {
        found.sort((left, right) => {
          const timeDifference =
            new Date(right.occurredAt).getTime() -
            new Date(left.occurredAt).getTime();
          return timeDifference || right.episodeNumber - left.episodeNumber;
        });
      }
      return found;
    },
    create: async ({ data }: any) => {
      sequence += 1;
      const now = new Date('2026-10-12T04:30:00.000Z');
      const record = {
        clearedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        acknowledgmentNote: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
        createdAt: now,
        updatedAt: now,
        ...data,
        id: data.id ?? `event-${sequence}`,
      };
      records.set(record.id, record);
      return record;
    },
    update: async ({ where, data }: any) => {
      const current = [...records.values()].find((record) =>
        matches(record, where),
      );
      if (!current) throw new Error('Record not found');
      const next = { ...current, ...data };
      records.set(next.id, next);
      return next;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const [key, value] of records) {
        if (!matches(value, where)) continue;
        records.set(key, { ...value, ...data });
        count += 1;
      }
      return { count };
    },
  };

  return {
    records,
    prisma: {
      alertEvent,
      $transaction: async (callback: any) => callback({ alertEvent }),
    } as unknown as PrismaService,
  };
}

function createMutableSensorsService() {
  const service = new SensorsService();
  let station = service.findByCode('BDG-AQ-003');
  const originalFindByCode = service.findByCode.bind(service);
  const originalFindAll = service.findAll.bind(service);

  service.findByCode = ((code: string) =>
    code === 'BDG-AQ-003' ? station : originalFindByCode(code)) as any;
  service.findAll = (() =>
    originalFindAll().map((item) =>
      item.code === 'BDG-AQ-003' ? station : item,
    )) as any;

  return {
    service,
    setStatus(status: 'ONLINE' | 'WARNING' | 'OFFLINE') {
      station = { ...station, status };
    },
  };
}

describe('EventsService persistence', () => {
  const referenceDate = new Date('2026-10-12T04:30:00.000Z');

  it('keeps one episode across repeated active reads', async () => {
    const { prisma, records } = createPrismaMock();
    const service = new EventsService(new SensorsService(), prisma);

    const first = await service.findBySensorCode('BDG-AQ-003', referenceDate);
    const second = await service.findBySensorCode('BDG-AQ-003', referenceDate);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(records.size).toBe(1);
    expect(first[0]).toMatchObject({
      conditionKey: 'BDG-AQ-003:AIR_QUALITY_ADVISORY',
      episodeNumber: 1,
      status: 'ACTIVE',
    });
  });

  it('does not reopen a manually resolved episode while condition remains', async () => {
    const { prisma, records } = createPrismaMock();
    const service = new EventsService(new SensorsService(), prisma);

    const first = await service.findBySensorCode('BDG-AQ-003', referenceDate);
    await service.resolve(first[0].id, {
      operator: 'network-operator',
      note: 'Reviewed',
    });
    const second = await service.findBySensorCode('BDG-AQ-003', referenceDate);

    expect(records.size).toBe(1);
    expect(second[0]).toMatchObject({
      id: first[0].id,
      episodeNumber: 1,
      status: 'RESOLVED',
      clearedAt: null,
    });
  });

  it('clears an episode and creates a new episode after recurrence', async () => {
    const { prisma, records } = createPrismaMock();
    const sensors = createMutableSensorsService();
    const service = new EventsService(sensors.service, prisma);

    const first = await service.findBySensorCode('BDG-AQ-003', referenceDate);
    sensors.setStatus('ONLINE');
    await service.findBySensorCode('BDG-AQ-003', referenceDate);

    const cleared = [...records.values()].find(
      (record) => record.id === first[0].id,
    );
    expect(cleared).toMatchObject({ status: 'RESOLVED' });
    expect(cleared?.clearedAt).toBeInstanceOf(Date);

    sensors.setStatus('WARNING');
    const recurrent = await service.findBySensorCode(
      'BDG-AQ-003',
      referenceDate,
    );

    expect(records.size).toBe(2);
    expect(recurrent[0]).toMatchObject({
      conditionKey: 'BDG-AQ-003:AIR_QUALITY_ADVISORY',
      episodeNumber: 2,
      status: 'ACTIVE',
      clearedAt: null,
    });
    expect(recurrent[0].id).not.toBe(first[0].id);
  });

  it('returns no records for a healthy station with no history', async () => {
    const { prisma } = createPrismaMock();
    const service = new EventsService(new SensorsService(), prisma);

    await expect(
      service.findBySensorCode('BDG-AQ-001', referenceDate),
    ).resolves.toEqual([]);
  });

  it('persists events from the global synchronization', async () => {
    const { prisma, records } = createPrismaMock();
    const service = new EventsService(new SensorsService(), prisma);

    const events = await service.findAll(referenceDate);

    expect(events.some((event) => event.sensorCode === 'BDG-AQ-003')).toBe(
      true,
    );
    expect(records.size).toBeGreaterThan(0);
  });
});
