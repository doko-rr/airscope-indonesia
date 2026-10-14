import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { EventActionDto } from './dto/event-action.dto';
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
  @Patch('events/:id/acknowledge')
  async acknowledge(@Param('id') id: string, @Body() action: EventActionDto) {
    return { data: await this.eventsService.acknowledge(id, action) };
  }

  @Patch('events/:id/resolve')
  async resolve(@Param('id') id: string, @Body() action: EventActionDto) {
    return { data: await this.eventsService.resolve(id, action) };
  }
}
