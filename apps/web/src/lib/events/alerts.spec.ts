import { buildAlerts, eventKind, sortAlertsBySeverity } from './alerts';
import { createEvent, stations } from '@/test/event-fixtures';

const referenceTime = new Date('2026-10-15T11:00:00.000Z').getTime();

describe('Alerts event helpers', () => {
  it('includes active and acknowledged events', () => {
    const alerts = buildAlerts(
      stations,
      [
        createEvent(),
        createEvent({
          id: 'acknowledged-event',
          status: 'ACKNOWLEDGED',
        }),
      ],
      referenceTime,
    );

    expect(alerts).toHaveLength(2);

    expect(alerts.map((alert) => alert.status)).toEqual([
      'ACTIVE',
      'ACKNOWLEDGED',
    ]);
  });

  it('excludes resolved events', () => {
    const alerts = buildAlerts(
      stations,
      [
        createEvent({
          status: 'RESOLVED',
          resolvedAt: '2026-10-15T10:30:00.000Z',
        }),
      ],
      referenceTime,
    );

    expect(alerts).toEqual([]);
  });

  it('keeps episode identity', () => {
    const alerts = buildAlerts(
      stations,
      [
        createEvent({
          episodeNumber: 3,
        }),
      ],
      referenceTime,
    );

    expect(alerts[0]).toMatchObject({
      conditionKey: 'BDG-AQ-002:STATION_OFFLINE',
      episodeNumber: 3,
    });
  });

  it('maps supported event types', () => {
    expect(eventKind(createEvent())).toBe('OFFLINE');

    expect(
      eventKind(
        createEvent({
          type: 'STATION_RECOVERED',
          severity: 'INFO',
        }),
      ),
    ).toBeNull();
  });

  it('orders critical before warning and caution', () => {
    const alerts = buildAlerts(
      stations,
      [
        createEvent({
          id: 'caution',
          severity: 'CAUTION',
          type: 'TELEMETRY_DELAYED',
        }),
        createEvent({
          id: 'warning',
          severity: 'WARNING',
          type: 'AIR_QUALITY_ADVISORY',
        }),
        createEvent({
          id: 'critical',
          severity: 'CRITICAL',
        }),
      ],
      referenceTime,
    );

    const ordered = sortAlertsBySeverity(alerts);

    expect(ordered.map((alert) => alert.severity)).toEqual([
      'CRITICAL',
      'WARNING',
      'CAUTION',
    ]);
  });
});
