import { SensorsService } from '../sensors/sensors.service';
import { EventsService } from './events.service';

describe('EventsService', () => {
  const service = new EventsService(new SensorsService());
  const referenceDate = new Date('2026-10-12T04:30:00.000Z');

  it('derives an air-quality advisory for the warning station', () => {
    const events = service.findBySensorCode('BDG-AQ-003', referenceDate);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sensorCode: 'BDG-AQ-003',
      type: 'AIR_QUALITY_ADVISORY',
      severity: 'WARNING',
      status: 'ACTIVE',
    });
  });

  it('does not create active events for a healthy current station', () => {
    expect(service.findBySensorCode('BDG-AQ-001', referenceDate)).toEqual([]);
  });

  it('returns globally ordered active events', () => {
    const events = service.findAll(referenceDate);

    expect(events.some((event) => event.sensorCode === 'BDG-AQ-003')).toBe(
      true,
    );
  });
});
