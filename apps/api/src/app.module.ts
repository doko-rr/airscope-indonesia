import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequestLoggingMiddleware } from './common/observability/request-logging.middleware';
import { PrismaModule } from './database/prisma.module';
import { EventsModule } from './modules/events/events.module';
import { SensorsModule } from './modules/sensors/sensors.module';

@Module({
  imports: [PrismaModule, SensorsModule, EventsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}
