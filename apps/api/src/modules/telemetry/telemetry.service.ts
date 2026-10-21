import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  decodeTelemetryPayloadV1,
  TelemetryValidationError,
  type TelemetryPayloadV1,
} from './telemetry-contract';
import {
  TELEMETRY_REPOSITORY,
  type PersistedTelemetryInput,
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

  getLatest(stationCode: string): TelemetryPayloadV1 | undefined {
    return this.latestByStation.get(stationCode.trim().toUpperCase());
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
