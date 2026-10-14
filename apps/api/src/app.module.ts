import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { EventsModule } from './modules/events/events.module';
import { SensorsModule } from './modules/sensors/sensors.module';

@Module({
  imports: [PrismaModule, SensorsModule, EventsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
