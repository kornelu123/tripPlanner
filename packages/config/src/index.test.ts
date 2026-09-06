import { describe, expect, it } from 'vitest';

import { readServerEnvironment } from './index';

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
