import {
  SensorMeasurement,
  SensorProfile,
  SensorStation,
} from '../types/sensor.types';

interface ProfileBaseline {
  pm25: number;
  pm10: number;
  co: number;
  co2: number;
  no2: number;
  so2: number;
  o3: number;
}

const PROFILE_BASELINES: Record<SensorProfile, ProfileBaseline> = {
  URBAN_TRAFFIC: {
    pm25: 28,
    pm10: 44,
    co: 0.75,
    co2: 490,
    no2: 25,
    so2: 4,
    o3: 18,
  },
  RESIDENTIAL: {
    pm25: 19,
    pm10: 30,
    co: 0.4,
    co2: 440,
    no2: 13,
    so2: 2.5,
    o3: 23,
  },
  ROADSIDE: {
    pm25: 34,
    pm10: 57,
    co: 0.95,
    co2: 520,
    no2: 32,
    so2: 5,
    o3: 15,
  },
  INDUSTRIAL: {
    pm25: 39,
    pm10: 66,
    co: 0.8,
    co2: 540,
    no2: 28,
    so2: 11,
    o3: 17,
  },
  BACKGROUND: {
    pm25: 11,
    pm10: 18,
    co: 0.2,
    co2: 415,
    no2: 6,
    so2: 1,
    o3: 29,
  },
  SUBURBAN: {
    pm25: 21,
    pm10: 35,
    co: 0.45,
    co2: 450,
    no2: 15,
    so2: 3,
    o3: 22,
  },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number, decimals = 1): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededValue(seed: string): number {
  const hashed = hashString(seed);
  return (hashed % 10000) / 10000;
}

function getJakartaTime(date: Date): {
  hour: number;
  minute: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: weekdayMap[values.weekday] ?? 1,
  };
}

function getTrafficFactor(
  hour: number,
  weekday: number,
  profile: SensorProfile,
): number {
  const isWeekday = weekday >= 1 && weekday <= 5;

  const morningPeak =
    hour >= 6 && hour < 10 ? Math.sin(((hour - 6) / 4) * Math.PI) : 0;

  const eveningPeak =
    hour >= 15 && hour < 21 ? Math.sin(((hour - 15) / 6) * Math.PI) : 0;

  const profileMultiplier: Record<SensorProfile, number> = {
    URBAN_TRAFFIC: 1,
    ROADSIDE: 1.15,
    INDUSTRIAL: 0.65,
    RESIDENTIAL: 0.4,
    SUBURBAN: 0.5,
    BACKGROUND: 0.1,
  };

  const weekdayMultiplier = isWeekday ? 1 : 0.72;

  return (
    Math.max(morningPeak, eveningPeak) *
    profileMultiplier[profile] *
    weekdayMultiplier
  );
}

function getDaylightFactor(hour: number): number {
  if (hour < 6 || hour > 18) {
    return 0;
  }

  return Math.sin(((hour - 6) / 12) * Math.PI);
}

export function simulateLatestMeasurement(
  station: SensorStation,
  inputDate = new Date(),
): SensorMeasurement {
  const bucketMilliseconds = 5 * 60 * 1000;
  const bucketTime =
    Math.floor(inputDate.getTime() / bucketMilliseconds) * bucketMilliseconds;

  const observedAt = new Date(bucketTime);
  const localTime = getJakartaTime(observedAt);
  const baseline = PROFILE_BASELINES[station.profile];

  const bucketKey = `${station.code}:${observedAt.toISOString()}`;
  const noise = seededValue(bucketKey) - 0.5;
  const secondaryNoise = seededValue(`${bucketKey}:secondary`) - 0.5;

  const trafficFactor = getTrafficFactor(
    localTime.hour,
    localTime.weekday,
    station.profile,
  );

  const daylightFactor = getDaylightFactor(localTime.hour);

  const dailyTemperature =
    22.5 + 7 * Math.sin(((localTime.hour - 6) / 24) * 2 * Math.PI);

  const elevationCorrection = station.location.elevationM > 1000 ? -3.5 : 0;

  const temperatureC = dailyTemperature + elevationCorrection + noise * 0.8;

  const humidityPct = clamp(
    84 - (temperatureC - 20) * 2.7 + secondaryNoise * 3,
    45,
    94,
  );

  const humidityParticleEffect =
    humidityPct > 80 ? (humidityPct - 80) * 0.18 : 0;

  const industrialFactor =
    station.profile === 'INDUSTRIAL' &&
    localTime.hour >= 7 &&
    localTime.hour <= 17
      ? 1
      : 0;

  const pm25 =
    baseline.pm25 +
    trafficFactor * 19 +
    industrialFactor * 9 +
    humidityParticleEffect +
    noise * 3;

  const pm10 =
    baseline.pm10 +
    trafficFactor * 27 +
    industrialFactor * 14 +
    humidityParticleEffect * 1.4 +
    secondaryNoise * 5;

  const no2 =
    baseline.no2 + trafficFactor * 20 + industrialFactor * 8 + noise * 2;

  const co =
    baseline.co + trafficFactor * 0.55 + industrialFactor * 0.2 + noise * 0.08;

  const so2 =
    baseline.so2 + industrialFactor * 7 + trafficFactor * 1.2 + secondaryNoise;

  const o3 = baseline.o3 + daylightFactor * 16 - trafficFactor * 5 + noise * 2;

  const co2 =
    baseline.co2 +
    trafficFactor * 75 +
    industrialFactor * 45 +
    secondaryNoise * 12;

  const pressureHpa =
    1013.25 - station.location.elevationM * 0.11 + secondaryNoise * 1.4;

  const qualityScore = clamp(
    97 - Math.abs(noise) * 3 - (station.status === 'WARNING' ? 8 : 0),
    70,
    99,
  );

  return {
    stationCode: station.code,
    observedAt: observedAt.toISOString(),
    source: 'SIMULATION',
    simulationModel: 'AIRSIM-DETERMINISTIC-V1',
    measurements: {
      pm25UgM3: round(clamp(pm25, 3, 180)),
      pm10UgM3: round(clamp(Math.max(pm10, pm25), 5, 260)),
      coPpm: round(clamp(co, 0.05, 8), 2),
      co2Ppm: Math.round(clamp(co2, 380, 1200)),
      no2Ppb: round(clamp(no2, 1, 160)),
      so2Ppb: round(clamp(so2, 0.3, 90)),
      o3Ppb: round(clamp(o3, 2, 100)),
      temperatureC: round(temperatureC),
      humidityPct: round(humidityPct),
      pressureHpa: round(pressureHpa),
    },
    device: {
      status: station.status,
      batteryVoltage: round(4.05 + noise * 0.08, 2),
      rssiDbm: Math.round(-77 + secondaryNoise * 12),
      network: 'LTE',
      firmware: station.firmware,
    },
    quality: {
      score: round(qualityScore),
      label:
        qualityScore >= 90 ? 'GOOD' : qualityScore >= 75 ? 'MODERATE' : 'LOW',
    },
  };
}
