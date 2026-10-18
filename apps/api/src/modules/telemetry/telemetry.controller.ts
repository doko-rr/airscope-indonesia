import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { MqttTelemetryClient } from './mqtt-telemetry.client';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly mqttClient: MqttTelemetryClient,
  ) {}

  @Get('status')
  getStatus() {
    return {
      data: {
        enabled: this.mqttClient.isEnabled(),
        connected: this.mqttClient.isConnected(),
        stationCount: this.telemetryService.getStationCount(),
      },
    };
  }

  @Get('stations/:stationCode/latest')
  getLatest(
    @Param('stationCode')
    stationCode: string,
  ) {
    const telemetry = this.telemetryService.getLatest(stationCode);

    if (!telemetry) {
      throw new NotFoundException(
        `Telemetry for station ${stationCode
          .trim()
          .toUpperCase()} was not found`,
      );
    }

    return {
      data: telemetry,
    };
  }
}
