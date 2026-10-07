import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SensorsModule } from './modules/sensors/sensors.module';

@Module({
  imports: [SensorsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
