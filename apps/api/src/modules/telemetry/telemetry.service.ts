import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  decodeTelemetryPayloadV1,
  TelemetryValidationError,
  type TelemetryPayloadV1,
} from './telemetry-contract';
import {
  TELEMETRY_REPOSITORY,
  type PersistedTelemetryInput,
  type PersistedTelemetryRecord,
  type TelemetryRepository,
} from './telemetry.repository';
import { parseTelemetryTopic } from './telemetry-topic';

export type TelemetryIngestionStatus = 'ACCEPTED' | 'DUPLICATE' | 'STALE';

export interface TelemetryIngestionResult {
  status: TelemetryIngestionStatus;
  payload: TelemetryPayloadV1;
}

export class TelemetryTopicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelemetryTopicError';
  }
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly latestByStation = new Map<string, TelemetryPayloadV1>();
  private readonly processedMessageIds = new Set<string>();

  constructor(
    @Inject(TELEMETRY_REPOSITORY)
    private readonly repository: TelemetryRepository,
  ) {}

  async ingest(
    topic: string,
    message: Buffer | string,
    topicPrefix = 'airscope/v1',
  ): Promise<TelemetryIngestionResult> {
    const parsedTopic = parseTelemetryTopic(topic, topicPrefix);

    if (!parsedTopic) {
      throw new TelemetryTopicError(`Unexpected telemetry topic: ${topic}`);
    }

    const payload = decodeTelemetryPayloadV1(message);

    if (parsedTopic.stationCode !== payload.stationCode) {
      throw new TelemetryTopicError(
        'Telemetry topic station code does not match payload station code.',
      );
    }

    const persistence = await this.repository.persist(
      this.toPersistedInput(payload),
    );

    if (persistence.status === 'DUPLICATE') {
      this.processedMessageIds.add(payload.messageId);
      this.logger.warn(
        JSON.stringify({
          event: 'mqtt_telemetry_duplicate',
          messageId: payload.messageId,
          stationCode: payload.stationCode,
          topic,
        }),
      );

      return { status: 'DUPLICATE', payload };
    }

    const current = this.latestByStation.get(payload.stationCode);

    if (
      current &&
      Date.parse(payload.observedAt) < Date.parse(current.observedAt)
    ) {
      this.processedMessageIds.add(payload.messageId);
      this.logger.warn(
        JSON.stringify({
          event: 'mqtt_telemetry_stale',
          messageId: payload.messageId,
          stationCode: payload.stationCode,
          observedAt: payload.observedAt,
          latestObservedAt: current.observedAt,
          topic,
        }),
      );

      return { status: 'STALE', payload };
    }

    this.processedMessageIds.add(payload.messageId);
    this.latestByStation.set(payload.stationCode, payload);
    this.logger.log(
      JSON.stringify({
        event: 'mqtt_telemetry_accepted',
        messageId: payload.messageId,
        stationCode: payload.stationCode,
        observedAt: payload.observedAt,
        topic,
      }),
    );

    return { status: 'ACCEPTED', payload };
  }

  async getLatest(
    stationCode: string,
  ): Promise<TelemetryPayloadV1 | undefined> {
    const normalizedCode = stationCode.trim().toUpperCase();
    const cached = this.latestByStation.get(normalizedCode);

    if (cached) {
      return cached;
    }

    const persisted = await this.repository.findLatest(normalizedCode);

    if (!persisted) {
      return undefined;
    }

    const payload = this.toPayload(persisted);
    this.latestByStation.set(normalizedCode, payload);
    this.processedMessageIds.add(payload.messageId);

    return payload;
  }

  hasProcessedMessage(messageId: string): boolean {
    return this.processedMessageIds.has(messageId);
  }

  getStationCount(): number {
    return this.latestByStation.size;
  }

  clear(): void {
    this.latestByStation.clear();
    this.processedMessageIds.clear();
  }

  private toPayload(record: PersistedTelemetryRecord): TelemetryPayloadV1 {
    // Validate database primitives again at the contract boundary.
    return decodeTelemetryPayloadV1(
      JSON.stringify({
        schemaVersion: record.schemaVersion,
        messageId: record.messageId,
        stationCode: record.stationCode,
        observedAt: record.observedAt,
        measurements: { ...record.measurements },
        device: { ...record.device },
      }),
    );
  }

  private toPersistedInput(
    payload: TelemetryPayloadV1,
  ): PersistedTelemetryInput {
    return {
      ...payload,
      source: 'MQTT',
    };
  }
}

export { TelemetryValidationError };
