import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return {
      name: 'AirScope Indonesia API',
      version: '0.1.0',
      health: '/api/v1/health',
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
}
