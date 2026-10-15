import type { SensorEvent, StationWithMeasurement } from '@/types/sensor';

const observedAt = '2026-10-15T10:00:00.000Z';

export const stations: StationWithMeasurement[] = [
  {
    station: {
      code: 'BDG-AQ-002',
      name: 'Station Two',
      city: 'Bandung',
      province: 'Jawa Barat',
      timezone: 'Asia/Jakarta',
      profile: 'RESIDENTIAL',
      status: 'OFFLINE',
      location: {
        latitude: -6.9,
        longitude: 107.6,
        elevationM: 700,
      },
      firmware: '1.0.0',
      isSimulated: true,
      installedAt: '2026-09-01T02:00:00.000Z',
      calibrationAt: '2026-10-01T02:00:00.000Z',
    },
    latest: {
      stationCode: 'BDG-AQ-002',
      observedAt,
      source: 'SIMULATION',
      simulationModel: 'TEST',
      measurements: {
        pm25UgM3: 30,
        pm10UgM3: 45,
        coPpm: 0.5,
        co2Ppm: 450,
        no2Ppb: 20,
        so2Ppb: 3,
        o3Ppb: 20,
        temperatureC: 27,
        humidityPct: 70,
        pressureHpa: 940,
      },
      device: {
        status: 'OFFLINE',
        batteryVoltage: 4,
        rssiDbm: -70,
        network: 'LTE',
        firmware: '1.0.0',
      },
      quality: {
        score: 90,
        label: 'GOOD',
      },
    },
  },
];

export function createEvent(overrides: Partial<SensorEvent> = {}): SensorEvent {
  return {
    id: 'event-1',
    conditionKey: 'BDG-AQ-002:STATION_OFFLINE',
    episodeNumber: 1,
    sensorCode: 'BDG-AQ-002',
    type: 'STATION_OFFLINE',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    title: 'Station offline',
    detail: 'Station is not reporting.',
    occurredAt: '2026-10-15T09:00:00.000Z',
    lastObservedAt: '2026-10-15T10:00:00.000Z',
    clearedAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    acknowledgmentNote: null,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    source: 'DERIVED_SIMULATION',
    ...overrides,
  };
}
