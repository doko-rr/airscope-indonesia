import { Injectable } from '@nestjs/common';
import { SensorsService } from '../sensors/sensors.service';
import type {
  SensorMeasurement,
  SensorStation,
} from '../sensors/types/sensor.types';
import type { SensorEvent } from './types/event.types';

const DELAYED_AFTER_MINUTES = 10;
const STALE_AFTER_MINUTES = 20;

@Injectable()
export class EventsService {
  constructor(private readonly sensorsService: SensorsService) {}

  findAll(referenceDate = new Date()): SensorEvent[] {
    return this.sensorsService
      .findAll()
      .flatMap((station) => this.deriveStationEvents(station, referenceDate))
      .sort((left, right) => {
        const severityOrder = { CRITICAL: 0, WARNING: 1, CAUTION: 2, INFO: 3 };
        return (
          severityOrder[left.severity] - severityOrder[right.severity] ||
          right.occurredAt.localeCompare(left.occurredAt) ||
          left.sensorCode.localeCompare(right.sensorCode)
        );
      });
  }

  findBySensorCode(code: string, referenceDate = new Date()): SensorEvent[] {
    const station = this.sensorsService.findByCode(code);
    return this.deriveStationEvents(station, referenceDate);
  }

  private deriveStationEvents(
    station: SensorStation,
    referenceDate: Date,
  ): SensorEvent[] {
    const measurement = this.sensorsService.getLatestMeasurement(station.code);
    const ageMinutes = this.measurementAgeMinutes(
      measurement.observedAt,
      referenceDate,
    );

    // Communication failures take precedence so one root cause creates one
    // active event. Offline supersedes stale; stale supersedes advisory.
    if (station.status === 'OFFLINE') {
      return [
        this.createEvent(
          station,
          measurement,
          'STATION_OFFLINE',
          'CRITICAL',
          'Station offline',
          'The station is not reporting to the observation network.',
        ),
      ];
    }

    if (!Number.isFinite(ageMinutes) || ageMinutes > STALE_AFTER_MINUTES) {
      return [
        this.createEvent(
          station,
          measurement,
          'TELEMETRY_STALE',
          'CRITICAL',
          'Telemetry stale',
          'The latest observation is more than 20 minutes old.',
        ),
      ];
    }

    const events: SensorEvent[] = [];

    if (station.status === 'WARNING') {
      events.push(
        this.createEvent(
          station,
          measurement,
          'AIR_QUALITY_ADVISORY',
          'WARNING',
          'Air-quality advisory',
          `PM2.5 is ${measurement.measurements.pm25UgM3.toFixed(1)} µg/m³ and requires attention.`,
        ),
      );
    }

    if (ageMinutes > DELAYED_AFTER_MINUTES) {
      events.push(
        this.createEvent(
          station,
          measurement,
          'TELEMETRY_DELAYED',
          'CAUTION',
          'Telemetry delayed',
          'The latest observation is between 11 and 20 minutes old.',
        ),
      );
    }

    return events;
  }

  private measurementAgeMinutes(
    observedAt: string,
    referenceDate: Date,
  ): number {
    const observedTime = new Date(observedAt).getTime();
    if (!Number.isFinite(observedTime)) return Number.POSITIVE_INFINITY;
    return Math.max(
      0,
      Math.floor((referenceDate.getTime() - observedTime) / 60_000),
    );
  }

  private createEvent(
    station: SensorStation,
    measurement: SensorMeasurement,
    type: SensorEvent['type'],
    severity: SensorEvent['severity'],
    title: string,
    detail: string,
  ): SensorEvent {
    const bucket = measurement.observedAt.replace(/[^0-9]/g, '').slice(0, 12);

    return {
      id: `${station.code}-${type}-${bucket}`,
      sensorCode: station.code,
      type,
      severity,
      status: 'ACTIVE',
      title,
      detail,
      occurredAt: measurement.observedAt,
      resolvedAt: null,
      source: 'DERIVED_SIMULATION',
    };
  }
}
