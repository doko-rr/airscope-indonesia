import type { PrismaService } from '../../database/prisma.service';
import { SensorsService } from '../sensors/sensors.service';
import { EventsService } from './events.service';

function createPrismaMock() {
  const records = new Map<string, Record<string, unknown>>();

  const alertEvent = {
    upsert: async ({ where, create, update }: any) => {
      const current = records.get(where.fingerprint);
      const next = current ? { ...current, ...update } : { ...create };
      records.set(where.fingerprint, next);
      return next;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const [key, value] of records) {
        const sensorMatch = where.sensorCode.in.includes(value.sensorCode);
        const statusMatch = value.status === where.status;
        const fingerprintMatch = where.fingerprint?.notIn
          ? !where.fingerprint.notIn.includes(value.fingerprint)
          : true;
        if (sensorMatch && statusMatch && fingerprintMatch) {
          records.set(key, { ...value, ...data });
          count += 1;
        }
      }
      return { count };
    },
    findMany: async ({ where }: any = {}) =>
      [...records.values()].filter(
        (record) =>
          !where?.sensorCode || record.sensorCode === where.sensorCode,
      ),
  };

  return {
    records,
    prisma: {
      alertEvent,
      $transaction: async (callback: any) => callback({ alertEvent }),
    } as unknown as PrismaService,
  };
}

describe('EventsService persistence', () => {
  const referenceDate = new Date('2026-10-12T04:30:00.000Z');

  it('persists an advisory without duplicating repeated reads', async () => {
    const { prisma, records } = createPrismaMock();
    const service = new EventsService(new SensorsService(), prisma);

    const first = await service.findBySensorCode('BDG-AQ-003', referenceDate);
    const second = await service.findBySensorCode('BDG-AQ-003', referenceDate);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(records.size).toBe(1);
    expect(first[0]).toMatchObject({
      sensorCode: 'BDG-AQ-003',
      type: 'AIR_QUALITY_ADVISORY',
      severity: 'WARNING',
      status: 'ACTIVE',
    });
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
