import { Injectable, NotFoundException } from '@nestjs/common';
import { SENSOR_STATIONS } from './data/sensor-stations.data';
import { simulateLatestMeasurement } from './simulation/sensor-simulator';
import { SensorMeasurement, SensorStation } from './types/sensor.types';

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

  getLatestMeasurement(code: string): SensorMeasurement {
    const station = this.findByCode(code);
    return simulateLatestMeasurement(station);
  }
}
