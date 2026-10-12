import { Controller, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('events')
  findAll() {
    const events = this.eventsService.findAll();

    return {
      data: events,
      metadata: {
        count: events.length,
        source: 'DERIVED_SIMULATION',
        severityOrder: ['CRITICAL', 'WARNING', 'CAUTION', 'INFO'],
      },
    };
  }

  @Get('sensors/:code/events')
  findBySensorCode(@Param('code') code: string) {
    const events = this.eventsService.findBySensorCode(code);

    return {
      data: events,
      metadata: {
        count: events.length,
        sensorCode: code.trim().toUpperCase(),
        source: 'DERIVED_SIMULATION',
      },
    };
  }
}
