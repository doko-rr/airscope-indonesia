import { Injectable, NotFoundException } from '@nestjs/common';
import { TelemetryService } from '../telemetry/telemetry.service';
import { SENSOR_STATIONS } from './data/sensor-stations.data';
import { simulateLatestMeasurement } from './simulation/sensor-simulator';
import {
  type SensorHistoryResult,
  type SensorMeasurement,
  type SensorStation,
} from './types/sensor.types';

@Injectable()
export class SensorsService {
  constructor(private readonly telemetryService: TelemetryService) {}

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

  async getLatestMeasurement(code: string): Promise<SensorMeasurement> {
    const station = this.findByCode(code);

    const telemetry = await this.telemetryService.getLatest(station.code);

    if (!telemetry) {
      return simulateLatestMeasurement(station);
    }

    return {
      stationCode: telemetry.stationCode,
      observedAt: telemetry.observedAt,
      source: 'MQTT',
      messageId: telemetry.messageId,
      measurements: {
        ...telemetry.measurements,
      },
      device: {
        ...telemetry.device,
      },
      quality: {
        score: 100,
        label: 'GOOD',
      },
    };
  }
}
