import { Controller, Get, Param } from '@nestjs/common';
import { SensorsService } from './sensors.service';

@Controller('sensors')
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Get()
  findAll() {
    const stations = this.sensorsService.findAll();

    return {
      data: stations,
      metadata: {
        count: stations.length,
        source: 'SIMULATION',
        notice:
          'Station metadata and measurements are simulated for development.',
      },
    };
  }

  @Get(':code/latest')
  getLatestMeasurement(@Param('code') code: string) {
    return {
      data: this.sensorsService.getLatestMeasurement(code),
    };
  }

  @Get(':code')
  findByCode(@Param('code') code: string) {
    return {
      data: this.sensorsService.findByCode(code),
    };
  }
}
