import { Global, Module } from '@nestjs/common';
import { MqttTelemetryClient } from './mqtt-telemetry.client';
import { TelemetryService } from './telemetry.service';

@Global()
@Module({
  providers: [TelemetryService, MqttTelemetryClient],
  exports: [TelemetryService, MqttTelemetryClient],
})
export class TelemetryModule {}
