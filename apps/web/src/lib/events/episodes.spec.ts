import { createEvent } from '@/test/event-fixtures';
import { groupEventEpisodes } from './episodes';

describe('Event episode grouping', () => {
  it('uses the highest episode number as current', () => {
    const groups = groupEventEpisodes([
      createEvent({
        id: 'episode-1',
        episodeNumber: 1,
      }),
      createEvent({
        id: 'episode-2',
        episodeNumber: 2,
        occurredAt: '2026-10-15T11:00:00.000Z',
      }),
    ]);

    expect(groups).toHaveLength(1);

    expect(groups[0].current.id).toBe('episode-2');
    expect(groups[0].current.episodeNumber).toBe(2);

    expect(groups[0].previous.map((event) => event.id)).toEqual(['episode-1']);
  });

  it('orders previous episodes from newest to oldest', () => {
    const groups = groupEventEpisodes([
      createEvent({
        id: 'episode-1',
        episodeNumber: 1,
      }),
      createEvent({
        id: 'episode-3',
        episodeNumber: 3,
        occurredAt: '2026-10-15T12:00:00.000Z',
      }),
      createEvent({
        id: 'episode-2',
        episodeNumber: 2,
        occurredAt: '2026-10-15T11:00:00.000Z',
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].current.id).toBe('episode-3');

    expect(groups[0].previous.map((event) => event.episodeNumber)).toEqual([
      2, 1,
    ]);
  });

  it('does not mix different conditions', () => {
    const groups = groupEventEpisodes([
      createEvent(),
      createEvent({
        id: 'advisory',
        conditionKey: 'BDG-AQ-002:AIR_QUALITY_ADVISORY',
        type: 'AIR_QUALITY_ADVISORY',
        severity: 'WARNING',
      }),
    ]);

    const conditionKeys = groups.map((group) => group.conditionKey);

    expect(groups).toHaveLength(2);

    expect(conditionKeys).toContain('BDG-AQ-002:STATION_OFFLINE');

    expect(conditionKeys).toContain('BDG-AQ-002:AIR_QUALITY_ADVISORY');
  });

  it('keeps each condition history independent', () => {
    const groups = groupEventEpisodes([
      createEvent({
        id: 'offline-episode-1',
        episodeNumber: 1,
      }),
      createEvent({
        id: 'offline-episode-2',
        episodeNumber: 2,
      }),
      createEvent({
        id: 'advisory-episode-1',
        conditionKey: 'BDG-AQ-002:AIR_QUALITY_ADVISORY',
        episodeNumber: 1,
        type: 'AIR_QUALITY_ADVISORY',
        severity: 'WARNING',
      }),
    ]);

    const offlineGroup = groups.find(
      (group) => group.conditionKey === 'BDG-AQ-002:STATION_OFFLINE',
    );

    const advisoryGroup = groups.find(
      (group) => group.conditionKey === 'BDG-AQ-002:AIR_QUALITY_ADVISORY',
    );

    expect(offlineGroup).toBeDefined();
    expect(offlineGroup?.current.id).toBe('offline-episode-2');
    expect(offlineGroup?.previous).toHaveLength(1);

    expect(advisoryGroup).toBeDefined();
    expect(advisoryGroup?.current.id).toBe('advisory-episode-1');
    expect(advisoryGroup?.previous).toEqual([]);
  });

  it('orders condition groups by current episode time', () => {
    const groups = groupEventEpisodes([
      createEvent({
        id: 'offline',
        occurredAt: '2026-10-15T09:00:00.000Z',
      }),
      createEvent({
        id: 'advisory',
        conditionKey: 'BDG-AQ-002:AIR_QUALITY_ADVISORY',
        type: 'AIR_QUALITY_ADVISORY',
        severity: 'WARNING',
        occurredAt: '2026-10-15T12:00:00.000Z',
      }),
    ]);

    expect(groups.map((group) => group.current.id)).toEqual([
      'advisory',
      'offline',
    ]);
  });

  it('returns an empty collection for no events', () => {
    expect(groupEventEpisodes([])).toEqual([]);
  });
});
