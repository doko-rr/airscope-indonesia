import { Module } from '@nestjs/common';
import { SensorsModule } from '../sensors/sensors.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [SensorsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
