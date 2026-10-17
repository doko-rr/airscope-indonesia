import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestLoggingMiddleware } from './request-logging.middleware';

function createResponse(statusCode: number): Response {
  const emitter = new EventEmitter();

  return Object.assign(emitter, {
    statusCode,
    setHeader: vi.fn(),
  }) as unknown as Response;
}

function createRequest(requestId?: string): Request {
  return {
    method: 'GET',
    originalUrl: '/api/v1/health',
    url: '/api/v1/health',
    headers: requestId
      ? {
          'x-request-id': requestId,
        }
      : {},
  } as unknown as Request;
}

describe('RequestLoggingMiddleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves a valid request ID and logs a successful request', () => {
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const middleware = new RequestLoggingMiddleware();

    const request = createRequest('client-request-123');

    const response = createResponse(200);

    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);

    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'client-request-123',
    );

    response.emit('finish');

    expect(log).toHaveBeenCalledTimes(1);

    const message = log.mock.calls[0][0];

    expect(typeof message).toBe('string');

    expect(JSON.parse(String(message))).toMatchObject({
      event: 'http_request_completed',
      service: 'airscope-api',
      requestId: 'client-request-123',
      method: 'GET',
      path: '/api/v1/health',
      statusCode: 200,
    });

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('logs client errors as warnings', () => {
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const middleware = new RequestLoggingMiddleware();

    const response = createResponse(404);

    middleware.use(createRequest(), response, vi.fn());

    response.emit('finish');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('logs server errors as errors', () => {
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const middleware = new RequestLoggingMiddleware();

    const response = createResponse(500);

    middleware.use(createRequest(), response, vi.fn());

    response.emit('finish');

    expect(error).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
