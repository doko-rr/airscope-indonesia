import type {
  EventsResponse,
  LatestMeasurementResponse,
  SensorHistoryResponse,
  SensorsResponse,
  StationWithMeasurement,
} from '@/types/sensor';

const API_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `AirScope API request failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function getEvents(): Promise<EventsResponse> {
  return fetchJson<EventsResponse>('/events');
}

export async function getSensors(): Promise<SensorsResponse> {
  return fetchJson<SensorsResponse>('/sensors');
}

export async function getStationOverview(): Promise<StationWithMeasurement[]> {
  const sensorsResponse = await getSensors();

  const measurements = await Promise.all(
    sensorsResponse.data.map(async (station) => {
      const response = await fetchJson<LatestMeasurementResponse>(
        `/sensors/${station.code}/latest`,
      );

      return {
        station,
        latest: response.data,
      };
    }),
  );

  return measurements;
}

export async function getSensorHistory(
  stationCode: string,
  hours = 24,
  interval = 60,
): Promise<SensorHistoryResponse> {
  const searchParams = new URLSearchParams({
    hours: String(hours),
    interval: String(interval),
  });

  return fetchJson<SensorHistoryResponse>(
    `/sensors/${stationCode}/measurements?${searchParams.toString()}`,
  );
}
