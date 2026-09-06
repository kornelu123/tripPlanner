import { describe, expect, it } from 'vitest';
import { redact } from './safe-logging';

describe('safe logging', () => {
  it('recursively redacts credentials, social metadata, and precise locations', () => {
    expect(
      redact({
        cookie: 'secret',
        nested: { token: 'secret', latitude: 1 },
        socialMetadata: { caption: 'private' },
        ok: 'visible',
      }),
    ).toEqual({
      cookie: '[REDACTED]',
      nested: { token: '[REDACTED]', latitude: '[REDACTED]' },
      socialMetadata: '[REDACTED]',
      ok: 'visible',
    });
  });
});
