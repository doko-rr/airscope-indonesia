import { SensorsService } from './sensors.service';

describe('SensorsService history', () => {
  const service = new SensorsService();
  const referenceDate = new Date('2026-10-08T12:34:00.000Z');

  it('generates a deterministic 24-hour hourly series', () => {
    const first = service.getMeasurementHistory(
      'BDG-AQ-001',
      24,
      60,
      referenceDate,
    );
    const second = service.getMeasurementHistory(
      'BDG-AQ-001',
      24,
      60,
      referenceDate,
    );

    expect(first.stationCode).toBe('BDG-AQ-001');
    expect(first.intervalMinutes).toBe(60);
    expect(first.measurements).toHaveLength(25);
    expect(first).toEqual(second);
  });

  it('keeps timestamps ordered at the requested interval', () => {
    const result = service.getMeasurementHistory(
      'BDG-AQ-003',
      2,
      30,
      referenceDate,
    );

    expect(result.measurements).toHaveLength(5);

    for (let index = 1; index < result.measurements.length; index += 1) {
      const previous = new Date(
        result.measurements[index - 1].observedAt,
      ).getTime();
      const current = new Date(result.measurements[index].observedAt).getTime();

      expect(current - previous).toBe(30 * 60 * 1000);
    }
  });

  it('throws for an unknown station', () => {
    expect(() =>
      service.getMeasurementHistory('INVALID', 24, 60, referenceDate),
    ).toThrow('Sensor station INVALID was not found');
  });
});
