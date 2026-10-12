import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AlertEvent } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
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
  constructor(
    private readonly sensorsService: SensorsService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(referenceDate = new Date()): Promise<SensorEvent[]> {
    const stations = this.sensorsService.findAll();
    const derived = stations.flatMap((station) =>
      this.deriveStationEvents(station, referenceDate),
    );

    await this.synchronizeEvents(
      derived,
      stations.map((station) => station.code),
    );

    const stored = await this.prisma.alertEvent.findMany({
      orderBy: [{ occurredAt: 'desc' }, { sensorCode: 'asc' }],
    });

    return stored.map((event) => this.toSensorEvent(event));
  }

  async findBySensorCode(
    code: string,
    referenceDate = new Date(),
  ): Promise<SensorEvent[]> {
    const station = this.sensorsService.findByCode(code);
    const derived = this.deriveStationEvents(station, referenceDate);

    await this.synchronizeEvents(derived, [station.code]);

    const stored = await this.prisma.alertEvent.findMany({
      where: { sensorCode: station.code },
      orderBy: { occurredAt: 'desc' },
    });

    return stored.map((event) => this.toSensorEvent(event));
  }

  private async synchronizeEvents(
    derived: SensorEvent[],
    sensorCodes: string[],
  ): Promise<void> {
    const activeFingerprints = derived.map((event) =>
      this.eventFingerprint(event.sensorCode, event.type),
    );

    await this.prisma.$transaction(async (transaction) => {
      for (const event of derived) {
        const fingerprint = this.eventFingerprint(event.sensorCode, event.type);

        await transaction.alertEvent.upsert({
          where: { fingerprint },
          create: {
            id: randomUUID(),
            fingerprint,
            sensorCode: event.sensorCode,
            type: event.type,
            severity: event.severity,
            status: 'ACTIVE',
            title: event.title,
            detail: event.detail,
            occurredAt: new Date(event.occurredAt),
            resolvedAt: null,
            source: event.source,
          },
          update: {
            severity: event.severity,
            status: 'ACTIVE',
            title: event.title,
            detail: event.detail,
            occurredAt: new Date(event.occurredAt),
            resolvedAt: null,
            source: event.source,
          },
        });
      }

      await transaction.alertEvent.updateMany({
        where: {
          sensorCode: { in: sensorCodes },
          status: 'ACTIVE',
          ...(activeFingerprints.length
            ? { fingerprint: { notIn: activeFingerprints } }
            : {}),
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });
    });
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

    if (station.status === 'OFFLINE') {
      return [
        this.createDerivedEvent(
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
        this.createDerivedEvent(
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
        this.createDerivedEvent(
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
        this.createDerivedEvent(
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

  private eventFingerprint(
    sensorCode: string,
    type: SensorEvent['type'],
  ): string {
    return `${sensorCode}:${type}`;
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

  private createDerivedEvent(
    station: SensorStation,
    measurement: SensorMeasurement,
    type: SensorEvent['type'],
    severity: SensorEvent['severity'],
    title: string,
    detail: string,
  ): SensorEvent {
    return {
      id: this.eventFingerprint(station.code, type),
      sensorCode: station.code,
      type,
      severity,
      status: 'ACTIVE',
      title,
      detail,
      occurredAt: measurement.observedAt,
      acknowledgedAt: null,
      acknowledgedBy: null,
      acknowledgmentNote: null,
      resolvedAt: null,
      source: 'DERIVED_SIMULATION',
    };
  }

  private toSensorEvent(event: AlertEvent): SensorEvent {
    return {
      id: event.id,
      sensorCode: event.sensorCode,
      type: event.type as SensorEvent['type'],
      severity: event.severity as SensorEvent['severity'],
      status: event.status as SensorEvent['status'],
      title: event.title,
      detail: event.detail,
      occurredAt: event.occurredAt.toISOString(),
      acknowledgedAt: event.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: event.acknowledgedBy,
      acknowledgmentNote: event.acknowledgmentNote,
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      source: event.source as SensorEvent['source'],
    };
  }
}
