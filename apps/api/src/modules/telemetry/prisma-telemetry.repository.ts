import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  PersistedTelemetryInput,
  PersistedTelemetryRecord,
  PersistTelemetryResult,
  TelemetryRepository,
} from './telemetry.repository';

type TelemetryRow = Awaited<
  ReturnType<PrismaService['telemetryMeasurement']['findFirst']>
>;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class PrismaTelemetryRepository implements TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persist(
    input: PersistedTelemetryInput,
  ): Promise<PersistTelemetryResult> {
    try {
      const row = await this.prisma.telemetryMeasurement.create({
        data: {
          messageId: input.messageId,
          schemaVersion: input.schemaVersion,
          stationCode: input.stationCode,
          observedAt: new Date(input.observedAt),
          source: input.source,
          ...input.measurements,
          deviceStatus: input.device.status,
          batteryVoltage: input.device.batteryVoltage,
          rssiDbm: input.device.rssiDbm,
          network: input.device.network,
          firmware: input.device.firmware,
        },
      });

      return { status: 'CREATED', record: this.mapRow(row) };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const duplicate = await this.prisma.telemetryMeasurement.findUnique({
        where: { messageId: input.messageId },
      });

      if (!duplicate) {
        throw error;
      }

      return { status: 'DUPLICATE', record: this.mapRow(duplicate) };
    }
  }

  async findLatest(
    stationCode: string,
  ): Promise<PersistedTelemetryRecord | null> {
    const row = await this.prisma.telemetryMeasurement.findFirst({
      where: { stationCode },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return row ? this.mapRow(row) : null;
  }

  async findHistory(
    stationCode: string,
    from: Date,
    to: Date,
    limit = 1000,
  ): Promise<PersistedTelemetryRecord[]> {
    const rows = await this.prisma.telemetryMeasurement.findMany({
      where: {
        stationCode,
        observedAt: { gte: from, lte: to },
      },
      orderBy: [{ observedAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: NonNullable<TelemetryRow>): PersistedTelemetryRecord {
    return {
      id: row.id,
      messageId: row.messageId,
      schemaVersion: row.schemaVersion,
      stationCode: row.stationCode,
      observedAt: row.observedAt.toISOString(),
      source: 'MQTT',
      measurements: {
        pm25UgM3: row.pm25UgM3,
        pm10UgM3: row.pm10UgM3,
        coPpm: row.coPpm,
        co2Ppm: row.co2Ppm,
        no2Ppb: row.no2Ppb,
        so2Ppb: row.so2Ppb,
        o3Ppb: row.o3Ppb,
        temperatureC: row.temperatureC,
        humidityPct: row.humidityPct,
        pressureHpa: row.pressureHpa,
      },
      device: {
        status: row.deviceStatus,
        batteryVoltage: row.batteryVoltage,
        rssiDbm: row.rssiDbm,
        network: row.network,
        firmware: row.firmware,
      },
      createdAt: row.createdAt.toISOString(),
    };
  }
}
