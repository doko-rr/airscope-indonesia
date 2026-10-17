import { describe, expect, it } from 'vitest';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id';

describe('resolveRequestId', () => {
  it('uses the expected request header name', () => {
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });

  it('preserves a valid client request ID', () => {
    expect(resolveRequestId('client-request_123:retry-1')).toBe(
      'client-request_123:retry-1',
    );
  });

  it('uses the first value from an array', () => {
    expect(resolveRequestId(['first-request', 'second-request'])).toBe(
      'first-request',
    );
  });

  it('creates a UUID when no ID is supplied', () => {
    expect(resolveRequestId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('replaces an invalid request ID', () => {
    const result = resolveRequestId('invalid request id');

    expect(result).not.toBe('invalid request id');

    expect(result).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('replaces a request ID longer than 128 characters', () => {
    const result = resolveRequestId('a'.repeat(129));

    expect(result).not.toBe('a'.repeat(129));

    expect(result).toMatch(/^[0-9a-f-]{36}$/);
  });
});
