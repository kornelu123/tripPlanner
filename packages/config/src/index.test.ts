import { describe, expect, it } from 'vitest';

import { readAuthEnvironment, readServerEnvironment } from './index';

describe('readServerEnvironment', () => {
  it('accepts PostgreSQL and Redis connection URLs', () => {
    expect(
      readServerEnvironment({
        DATABASE_URL: 'postgresql://localhost/trips',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toEqual({
      DATABASE_URL: 'postgresql://localhost/trips',
      REDIS_URL: 'redis://localhost:6379',
    });
  });

  it('rejects missing configuration', () => {
    expect(() => readServerEnvironment({})).toThrow();
  });
});

describe('readAuthEnvironment', () => {
  it('accepts a complete Apple login configuration', () => {
    expect(
      readAuthEnvironment({
        APPLE_CLIENT_ID: 'com.example.web',
        APPLE_TEAM_ID: 'TEAM123',
        APPLE_KEY_ID: 'KEY123',
        APPLE_PRIVATE_KEY: 'private-key',
      }).APPLE_CLIENT_ID,
    ).toBe('com.example.web');
  });

  it('rejects a partial Apple login configuration', () => {
    expect(() =>
      readAuthEnvironment({ APPLE_CLIENT_ID: 'com.example.web' }),
    ).toThrow('All Apple login credentials must be configured together.');
  });
});
