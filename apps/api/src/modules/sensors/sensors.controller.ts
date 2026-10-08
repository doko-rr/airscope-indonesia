import { Controller, Get, Param, Query } from '@nestjs/common';
import { HistoryQueryDto } from './dto/history-query.dto';
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

  @Get(':code/measurements')
  getMeasurementHistory(
    @Param('code') code: string,
    @Query() query: HistoryQueryDto,
  ) {
    const history = this.sensorsService.getMeasurementHistory(
      code,
      query.hours,
      query.interval,
    );

    return {
      data: history,
      metadata: {
        count: history.measurements.length,
        source: 'SIMULATION',
        simulationModel: 'AIRSIM-DETERMINISTIC-V1',
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
