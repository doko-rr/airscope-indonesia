import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API information', () => {
      expect(appController.getRoot()).toEqual({
        name: 'AirScope Indonesia API',
        version: '0.1.0',
        health: '/api/v1/health',
      });
    });
  });

  describe('health', () => {
    it('should return healthy service status', () => {
      const result = appController.getHealth();

      expect(result).toMatchObject({
        status: 'ok',
        service: 'airscope-api',
        version: '0.1.0',
      });

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });
  });
});
