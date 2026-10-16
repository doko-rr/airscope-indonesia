import { Injectable } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getRoot() {
    return {
      name: 'AirScope Indonesia API',
      version: '0.1.0',
      health: '/api/v1/health',
      readiness: '/api/v1/ready',
    };
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'airscope-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    await this.prisma.checkConnection();

    return {
      status: 'ready',
      service: 'airscope-api',
      database: 'available',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
