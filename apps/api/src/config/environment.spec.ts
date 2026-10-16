import { describe, expect, it } from 'vitest';
import { loadEnvironment } from './environment';

describe('loadEnvironment', () => {
  it('uses safe development defaults', () => {
    expect(loadEnvironment({})).toEqual({
      nodeEnv: 'development',
      port: 4000,
      databaseUrl: 'file:./prisma/dev.db',
      frontendUrl: 'http://localhost:3000',
    });
  });

  it('accepts an explicit production configuration', () => {
    expect(
      loadEnvironment({
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL: 'file:./prisma/production.db',
        FRONTEND_URL: 'https://airscope.example.com/',
      }),
    ).toEqual({
      nodeEnv: 'production',
      port: 8080,
      databaseUrl: 'file:./prisma/production.db',
      frontendUrl: 'https://airscope.example.com',
    });
  });

  it('requires DATABASE_URL in production', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://airscope.example.com',
      }),
    ).toThrow('DATABASE_URL is required in production.');
  });

  it('requires FRONTEND_URL in production', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'file:./prisma/production.db',
      }),
    ).toThrow('FRONTEND_URL is required in production.');
  });

  it('rejects an invalid port', () => {
    expect(() =>
      loadEnvironment({
        PORT: '70000',
      }),
    ).toThrow('PORT must be an integer between 1 and 65535.');
  });

  it('rejects an unsupported database URL', () => {
    expect(() =>
      loadEnvironment({
        DATABASE_URL: 'postgresql://localhost/airscope',
      }),
    ).toThrow('DATABASE_URL must use a file: URL while AirScope uses SQLite.');
  });

  it('rejects an invalid frontend URL', () => {
    expect(() =>
      loadEnvironment({
        FRONTEND_URL: 'not-a-url',
      }),
    ).toThrow('FRONTEND_URL must be a valid absolute URL.');
  });
});
