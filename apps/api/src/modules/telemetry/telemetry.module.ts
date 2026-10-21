import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { MqttTelemetryClient } from './mqtt-telemetry.client';
import { PrismaTelemetryRepository } from './prisma-telemetry.repository';
import { TelemetryController } from './telemetry.controller';
import { TELEMETRY_REPOSITORY } from './telemetry.repository';
import { TelemetryService } from './telemetry.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [TelemetryController],
  providers: [
    PrismaTelemetryRepository,
    {
      provide: TELEMETRY_REPOSITORY,
      useExisting: PrismaTelemetryRepository,
    },
    TelemetryService,
    MqttTelemetryClient,
  ],
  exports: [TelemetryService, MqttTelemetryClient, TELEMETRY_REPOSITORY],
})
export class TelemetryModule {}
