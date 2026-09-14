import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  maximumRequestBytes,
  protectRequest,
  rateLimitPerMinute,
  resetRequestSecurityForTests,
} from './request-security';

describe('request security', () => {
  beforeEach(resetRequestSecurityForTests);
  afterEach(() => vi.unstubAllEnvs());

  it('accepts browser-confirmed same-origin mutations from an origin alias', () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    const response = protectRequest(
      new Request('http://127.0.0.1:3000/api/account', {
        method: 'DELETE',
        headers: {
          cookie: '__Host-roamly_session=secret',
          origin: 'http://127.0.0.1:3000',
          'sec-fetch-site': 'same-origin',
        },
      }),
    );
    expect(response).toBeUndefined();
  });

  it('rejects cross-site cookie-authenticated mutations', () => {
    const response = protectRequest(
      new Request('https://roamly.test/api/account', {
        method: 'DELETE',
        headers: {
          cookie: '__Host-roamly_session=secret',
          origin: 'https://evil.test',
          'sec-fetch-site': 'cross-site',
        },
      }),
    );
    expect(response?.status).toBe(403);
  });

  it('rejects cross-site fetch metadata even when the origin matches', () => {
    vi.stubEnv('APP_URL', 'https://roamly.test');
    const response = protectRequest(
      new Request('http://localhost:3000/api/account', {
        method: 'DELETE',
        headers: {
          cookie: '__Host-roamly_session=secret',
          origin: 'https://roamly.test',
          'sec-fetch-site': 'cross-site',
        },
      }),
    );
    expect(response?.status).toBe(403);
  });

  it('rejects same-site mutations from a sibling origin', () => {
    vi.stubEnv('APP_URL', 'https://app.roamly.test');
    const response = protectRequest(
      new Request('https://app.roamly.test/api/account', {
        method: 'DELETE',
        headers: {
          cookie: '__Host-roamly_session=secret',
          origin: 'https://other.roamly.test',
          'sec-fetch-site': 'same-site',
        },
      }),
    );
    expect(response?.status).toBe(403);
  });

  it('accepts matching origins when Fetch Metadata is unavailable', () => {
    vi.stubEnv('APP_URL', 'https://roamly.test');
    const response = protectRequest(
      new Request('http://localhost:3000/api/account', {
        method: 'DELETE',
        headers: {
          cookie: '__Host-roamly_session=secret',
          origin: 'https://roamly.test',
        },
      }),
    );
    expect(response).toBeUndefined();
  });

  it('rejects mutations without Origin or Fetch Metadata', () => {
    const response = protectRequest(
      new Request('https://roamly.test/api/account', {
        method: 'DELETE',
        headers: { cookie: '__Host-roamly_session=secret' },
      }),
    );
    expect(response?.status).toBe(403);
  });

  it('rejects oversized requests', () => {
    const response = protectRequest(
      new Request('https://roamly.test/api/imports', {
        method: 'POST',
        headers: { 'content-length': String(maximumRequestBytes + 1) },
      }),
    );
    expect(response?.status).toBe(413);
  });

  it('rate limits repeated requests', () => {
    let response;
    for (let index = 0; index <= rateLimitPerMinute; index++)
      response = protectRequest(new Request('https://roamly.test/api/geocode'));
    expect(response?.status).toBe(429);
  });
});
