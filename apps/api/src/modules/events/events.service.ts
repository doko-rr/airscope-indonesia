import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AlertEvent } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SensorsService } from '../sensors/sensors.service';
import type {
  SensorMeasurement,
  SensorStation,
} from '../sensors/types/sensor.types';
import type { EventActionDto } from './dto/event-action.dto';
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
      orderBy: [{ occurredAt: 'desc' }, { episodeNumber: 'desc' }],
    });

    return stored.map((event) => this.toSensorEvent(event));
  }

  private async synchronizeEvents(
    derived: SensorEvent[],
    sensorCodes: string[],
  ): Promise<void> {
    const activeConditionKeys = derived.map((event) =>
      this.eventConditionKey(event.sensorCode, event.type),
    );
    const synchronizedAt = new Date();

    await this.prisma.$transaction(async (transaction) => {
      for (const event of derived) {
        const conditionKey = this.eventConditionKey(
          event.sensorCode,
          event.type,
        );
        const activeEpisode = await transaction.alertEvent.findFirst({
          where: {
            conditionKey,
            status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
          },
          orderBy: { episodeNumber: 'desc' },
        });

        if (activeEpisode) {
          await transaction.alertEvent.update({
            where: { id: activeEpisode.id },
            data: {
              severity: event.severity,
              title: event.title,
              detail: event.detail,
              lastObservedAt: new Date(event.occurredAt),
              source: event.source,
            },
          });
          continue;
        }

        const latestEpisode = await transaction.alertEvent.findFirst({
          where: { conditionKey },
          orderBy: { episodeNumber: 'desc' },
        });

        if (
          latestEpisode?.status === 'RESOLVED' &&
          latestEpisode.clearedAt === null
        ) {
          await transaction.alertEvent.update({
            where: { id: latestEpisode.id },
            data: {
              severity: event.severity,
              title: event.title,
              detail: event.detail,
              lastObservedAt: new Date(event.occurredAt),
              source: event.source,
            },
          });
          continue;
        }

        const episodeNumber = (latestEpisode?.episodeNumber ?? 0) + 1;

        await transaction.alertEvent.create({
          data: {
            id: randomUUID(),
            conditionKey,
            episodeNumber,
            fingerprint: this.episodeFingerprint(conditionKey, episodeNumber),
            sensorCode: event.sensorCode,
            type: event.type,
            severity: event.severity,
            status: 'ACTIVE',
            title: event.title,
            detail: event.detail,
            occurredAt: new Date(event.occurredAt),
            lastObservedAt: new Date(event.occurredAt),
            clearedAt: null,
            resolvedAt: null,
            source: event.source,
          },
        });
      }

      const missingConditionFilter = activeConditionKeys.length
        ? { conditionKey: { notIn: activeConditionKeys } }
        : {};

      await transaction.alertEvent.updateMany({
        where: {
          sensorCode: { in: sensorCodes },
          status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
          ...missingConditionFilter,
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: synchronizedAt,
          clearedAt: synchronizedAt,
        },
      });

      await transaction.alertEvent.updateMany({
        where: {
          sensorCode: { in: sensorCodes },
          status: 'RESOLVED',
          clearedAt: null,
          ...missingConditionFilter,
        },
        data: {
          clearedAt: synchronizedAt,
        },
      });
    });
  }

  async acknowledge(id: string, action: EventActionDto): Promise<SensorEvent> {
    const current = await this.findStoredEvent(id);

    if (current.status === 'RESOLVED') {
      throw new ConflictException('Resolved events cannot be acknowledged');
    }

    if (current.status === 'ACKNOWLEDGED') {
      return this.toSensorEvent(current);
    }

    const updated = await this.prisma.alertEvent.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: action.operator,
        acknowledgmentNote: action.note ?? null,
      },
    });

    return this.toSensorEvent(updated);
  }

  async resolve(id: string, action: EventActionDto): Promise<SensorEvent> {
    const current = await this.findStoredEvent(id);

    if (current.status === 'RESOLVED') {
      return this.toSensorEvent(current);
    }

    const updated = await this.prisma.alertEvent.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: action.operator,
        resolutionNote: action.note ?? null,
      },
    });

    return this.toSensorEvent(updated);
  }

  private async findStoredEvent(id: string): Promise<AlertEvent> {
    const event = await this.prisma.alertEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException(`Event ${id} was not found`);
    return event;
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

  private eventConditionKey(
    sensorCode: string,
    type: SensorEvent['type'],
  ): string {
    return `${sensorCode}:${type}`;
  }

  private episodeFingerprint(
    conditionKey: string,
    episodeNumber: number,
  ): string {
    return episodeNumber === 1
      ? conditionKey
      : `${conditionKey}:episode:${episodeNumber}`;
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
    const conditionKey = this.eventConditionKey(station.code, type);

    return {
      id: conditionKey,
      conditionKey,
      episodeNumber: 1,
      sensorCode: station.code,
      type,
      severity,
      status: 'ACTIVE',
      title,
      detail,
      occurredAt: measurement.observedAt,
      lastObservedAt: measurement.observedAt,
      clearedAt: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      acknowledgmentNote: null,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      source: 'DERIVED_SIMULATION',
    };
  }

  private toSensorEvent(event: AlertEvent): SensorEvent {
    return {
      id: event.id,
      conditionKey: event.conditionKey ?? event.fingerprint,
      episodeNumber: event.episodeNumber,
      sensorCode: event.sensorCode,
      type: event.type as SensorEvent['type'],
      severity: event.severity as SensorEvent['severity'],
      status: event.status as SensorEvent['status'],
      title: event.title,
      detail: event.detail,
      occurredAt: event.occurredAt.toISOString(),
      lastObservedAt: (event.lastObservedAt ?? event.occurredAt).toISOString(),
      clearedAt: event.clearedAt?.toISOString() ?? null,
      acknowledgedAt: event.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: event.acknowledgedBy,
      acknowledgmentNote: event.acknowledgmentNote,
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
      resolvedBy: event.resolvedBy,
      resolutionNote: event.resolutionNote,
      source: event.source as SensorEvent['source'],
    };
  }
}
