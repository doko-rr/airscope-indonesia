export type SensorStatus =
  | "ONLINE"
  | "WARNING"
  | "OFFLINE"
  | "MAINTENANCE";

export type SensorProfile =
  | "URBAN_TRAFFIC"
  | "RESIDENTIAL"
  | "ROADSIDE"
  | "INDUSTRIAL"
  | "BACKGROUND"
  | "SUBURBAN";

export interface SensorStation {
  code: string;
  name: string;
  city: string;
  province: string;
  timezone: string;
  profile: SensorProfile;
  status: SensorStatus;
  location: {
    latitude: number;
    longitude: number;
    elevationM: number;
  };
  firmware: string;
  isSimulated: boolean;
  installedAt: string;
  calibrationAt: string;
}

export interface SensorMeasurement {
  stationCode: string;
  observedAt: string;
  source: "SIMULATION";
  simulationModel: string;
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
    network: "LTE";
    firmware: string;
  };
  quality: {
    score: number;
    label: "GOOD" | "MODERATE" | "LOW";
  };
}

export interface SensorsResponse {
  data: SensorStation[];
  metadata: {
    count: number;
    source: "SIMULATION";
    notice: string;
  };
}

export interface LatestMeasurementResponse {
  data: SensorMeasurement;
}

export interface StationWithMeasurement {
  station: SensorStation;
  latest: SensorMeasurement;
}
