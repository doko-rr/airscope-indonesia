import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { connect, type IClientOptions, type MqttClient } from 'mqtt';
import {
  loadEnvironment,
  type ApplicationEnvironment,
} from '../../config/environment';
import { TelemetryService } from './telemetry.service';
import { buildTelemetrySubscription } from './telemetry-topic';

@Injectable()
export class MqttTelemetryClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttTelemetryClient.name);
  private client: MqttClient | undefined;
  private environment: ApplicationEnvironment | undefined;

  constructor(private readonly telemetryService: TelemetryService) {}

  onModuleInit(): void {
    const environment = loadEnvironment();
    this.environment = environment;

    if (!environment.mqttEnabled) {
      this.logger.log(JSON.stringify({ event: 'mqtt_client_disabled' }));
      return;
    }

    const options: IClientOptions = {
      clientId: environment.mqttClientId,
      clean: true,
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
    };
    const client = connect(environment.mqttUrl, options);
    this.client = client;

    client.on('connect', () => {
      void this.subscribe(client);
    });
    client.on('message', (topic, message) => {
      void this.handleMessage(topic, message);
    });
    client.on('reconnect', () => {
      this.logger.warn(
        JSON.stringify({
          event: 'mqtt_client_reconnecting',
          url: environment.mqttUrl,
        }),
      );
    });
    client.on('error', (error) => {
      this.logger.error(
        JSON.stringify({ event: 'mqtt_client_error', message: error.message }),
      );
    });
    client.on('close', () => {
      this.logger.warn(JSON.stringify({ event: 'mqtt_client_closed' }));
    });
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    if (!client) return;
    this.client = undefined;
    await client.endAsync();
    this.logger.log(JSON.stringify({ event: 'mqtt_client_disconnected' }));
  }

  isEnabled(): boolean {
    return this.environment?.mqttEnabled ?? false;
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  private async subscribe(client: MqttClient): Promise<void> {
    const environment = this.environment;
    if (!environment) return;
    const topic = buildTelemetrySubscription(environment.mqttTopicPrefix);

    try {
      await client.subscribeAsync(topic, { qos: 1 });
      this.logger.log(
        JSON.stringify({
          event: 'mqtt_client_subscribed',
          topic,
          clientId: environment.mqttClientId,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'mqtt_subscription_failed',
          topic,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private async handleMessage(topic: string, message: Buffer): Promise<void> {
    const environment = this.environment;
    if (!environment) return;

    try {
      await this.telemetryService.ingest(
        topic,
        message,
        environment.mqttTopicPrefix,
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'mqtt_telemetry_rejected',
          topic,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
