import { Injectable, NotFoundException } from '@nestjs/common';
import { SENSOR_STATIONS } from './data/sensor-stations.data';
import { simulateLatestMeasurement } from './simulation/sensor-simulator';
import {
  SensorHistoryResult,
  SensorMeasurement,
  SensorStation,
} from './types/sensor.types';

@Injectable()
export class SensorsService {
  findAll(): SensorStation[] {
    return SENSOR_STATIONS;
  }

  findByCode(code: string): SensorStation {
    const normalizedCode = code.trim().toUpperCase();

    const station = SENSOR_STATIONS.find(
      (item) => item.code === normalizedCode,
    );

    if (!station) {
      throw new NotFoundException(
        `Sensor station ${normalizedCode} was not found`,
      );
    }

    return station;
  }

  getMeasurementHistory(
    code: string,
    hours = 24,
    intervalMinutes = 60,
    referenceDate = new Date(),
  ): SensorHistoryResult {
    const station = this.findByCode(code);
    const intervalMilliseconds = intervalMinutes * 60 * 1000;

    const toMilliseconds =
      Math.floor(referenceDate.getTime() / intervalMilliseconds) *
      intervalMilliseconds;

    const fromMilliseconds = toMilliseconds - hours * 60 * 60 * 1000;

    const measurements: SensorHistoryResult['measurements'] = [];

    for (
      let timestamp = fromMilliseconds;
      timestamp <= toMilliseconds;
      timestamp += intervalMilliseconds
    ) {
      const simulated = simulateLatestMeasurement(station, new Date(timestamp));

      measurements.push({
        observedAt: simulated.observedAt,
        pm25UgM3: simulated.measurements.pm25UgM3,
        pm10UgM3: simulated.measurements.pm10UgM3,
        temperatureC: simulated.measurements.temperatureC,
        humidityPct: simulated.measurements.humidityPct,
      });
    }

    return {
      stationCode: station.code,
      from: new Date(fromMilliseconds).toISOString(),
      to: new Date(toMilliseconds).toISOString(),
      intervalMinutes,
      measurements,
    };
  }

  getLatestMeasurement(code: string): SensorMeasurement {
    const station = this.findByCode(code);

    return simulateLatestMeasurement(station);
  }
}
