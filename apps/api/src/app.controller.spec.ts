import { Test, type TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './database/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  const prisma = {
    checkConnection: vi.fn(),
  };

  beforeEach(async () => {
    prisma.checkConnection.mockReset();
    prisma.checkConnection.mockResolvedValue(undefined);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns API information', () => {
      expect(appController.getRoot()).toEqual({
        name: 'AirScope Indonesia API',
        version: '0.1.0',
        health: '/api/v1/health',
        readiness: '/api/v1/ready',
      });
    });
  });

  describe('health', () => {
    it('returns healthy service status', () => {
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

  describe('readiness', () => {
    it('returns ready when the database is available', async () => {
      const result = await appController.getReadiness();

      expect(prisma.checkConnection).toHaveBeenCalledTimes(1);

      expect(result).toMatchObject({
        status: 'ready',
        service: 'airscope-api',
        database: 'available',
        version: '0.1.0',
      });

      expect(result.timestamp).toBeDefined();

      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('propagates database connectivity failures', async () => {
      const databaseError = new Error('Database unavailable');

      prisma.checkConnection.mockRejectedValueOnce(databaseError);

      await expect(appController.getReadiness()).rejects.toBe(databaseError);
    });
  });
});
