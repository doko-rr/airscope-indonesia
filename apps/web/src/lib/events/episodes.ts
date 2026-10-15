import type { SensorEvent } from '@/types/sensor';

export interface EventEpisodeGroup {
  conditionKey: string;
  current: SensorEvent;
  previous: SensorEvent[];
}

export function groupEventEpisodes(events: SensorEvent[]): EventEpisodeGroup[] {
  const grouped = new Map<string, SensorEvent[]>();

  for (const event of events) {
    const episodes = grouped.get(event.conditionKey) ?? [];

    episodes.push(event);
    grouped.set(event.conditionKey, episodes);
  }

  return [...grouped.entries()]
    .map(([conditionKey, episodes]) => {
      const ordered = [...episodes].sort(
        (first, second) => second.episodeNumber - first.episodeNumber,
      );

      return {
        conditionKey,
        current: ordered[0],
        previous: ordered.slice(1),
      };
    })
    .sort(
      (first, second) =>
        new Date(second.current.occurredAt).getTime() -
        new Date(first.current.occurredAt).getTime(),
    );
}
