import { Global, Module } from '@nestjs/common';
import { MqttTelemetryClient } from './mqtt-telemetry.client';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Global()
@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService, MqttTelemetryClient],
  exports: [TelemetryService, MqttTelemetryClient],
})
export class TelemetryModule {}
