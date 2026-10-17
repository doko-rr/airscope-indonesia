import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);

    const startedAt = process.hrtime.bigint();

    request.headers[REQUEST_ID_HEADER] = requestId;

    response.setHeader(REQUEST_ID_HEADER, requestId);

    response.once('finish', () => {
      const elapsed = process.hrtime.bigint() - startedAt;

      const durationMs = Number(elapsed / 1_000_000n);

      const message = JSON.stringify({
        event: 'http_request_completed',
        service: 'airscope-api',
        requestId,
        method: request.method,
        path: request.originalUrl || request.url,
        statusCode: response.statusCode,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      if (response.statusCode >= 500) {
        this.logger.error(message);
        return;
      }

      if (response.statusCode >= 400) {
        this.logger.warn(message);
        return;
      }

      this.logger.log(message);
    });

    next();
  }
}
