import { Controller, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('events')
  async findAll() {
    const events = await this.eventsService.findAll();

    return {
      data: events,
      metadata: {
        count: events.length,
        source: 'PERSISTED_DERIVED_SIMULATION',
        severityOrder: ['CRITICAL', 'WARNING', 'CAUTION', 'INFO'],
      },
    };
  }

  @Get('sensors/:code/events')
  async findBySensorCode(@Param('code') code: string) {
    const events = await this.eventsService.findBySensorCode(code);

    return {
      data: events,
      metadata: {
        count: events.length,
        sensorCode: code.trim().toUpperCase(),
        source: 'PERSISTED_DERIVED_SIMULATION',
      },
    };
  }
}
