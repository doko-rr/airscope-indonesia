export type SensorStatus = 'ONLINE' | 'WARNING' | 'OFFLINE' | 'MAINTENANCE';

export type SensorProfile =
  | 'URBAN_TRAFFIC'
  | 'RESIDENTIAL'
  | 'ROADSIDE'
  | 'INDUSTRIAL'
  | 'BACKGROUND'
  | 'SUBURBAN';

export interface SensorLocation {
  latitude: number;
  longitude: number;
  elevationM: number;
}

export interface SensorStation {
  code: string;
  name: string;
  city: string;
  province: string;
  timezone: string;
  profile: SensorProfile;
  status: SensorStatus;
  location: SensorLocation;
  firmware: string;
  isSimulated: true;
  installedAt: string;
  calibrationAt: string;
}

export interface SensorMeasurement {
  stationCode: string;
  observedAt: string;
  source: 'SIMULATION' | 'MQTT';
  simulationModel?: string;
  messageId?: string;
  measurements: {
    pm25UgM3: number;
    pm10UgM3: number;
    coPpm: number;
    co2Ppm: number;
    no2Ppb: number;
    so2Ppb: number;
    o3Ppb: number;
    temperatureC: number;
    humidityPct: number;
    pressureHpa: number;
  };
  device: {
    status: SensorStatus;
    batteryVoltage: number;
    rssiDbm: number;
    network: string;
    firmware: string;
  };
  quality: {
    score: number;
    label: 'GOOD' | 'MODERATE' | 'LOW';
  };
}

export interface SensorHistoryPoint {
  observedAt: string;
  pm25UgM3: number;
  pm10UgM3: number;
  temperatureC: number;
  humidityPct: number;
}

export interface SensorHistoryResult {
  stationCode: string;
  from: string;
  to: string;
  intervalMinutes: number;
  measurements: SensorHistoryPoint[];
}
