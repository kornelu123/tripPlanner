import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';

import {
  authorizeTrip,
  clearSessionCookie,
  hashPassword,
  isApplePrivateRelay,
  normalizeEmail,
  setSessionCookie,
  tokenHash,
  verifyPassword,
} from './auth';

describe('authentication security helpers', () => {
  it('allows the public demo trip without a session', async () => {
    const auth = await authorizeTrip(new Request('http://localhost'), 'demo');

    expect(auth).toMatchObject({
      error: null,
      user: { id: 'demo-user' },
    });
  });

  it('normalizes Apple relay addresses without replacing them', () => {
    const email = normalizeEmail(' RANDOM@PrivateRelay.AppleID.com ');
    expect(email).toBe('random@privaterelay.appleid.com');
    expect(isApplePrivateRelay(email)).toBe(true);
    expect(isApplePrivateRelay('person@example.com')).toBe(false);
  });

  it('hashes bearer secrets before persistence', () => {
    expect(tokenHash('secret')).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash('secret')).not.toContain('secret');
  });

  it('hashes and verifies passwords without storing the password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).not.toContain('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(
      true,
    );
    expect(await verifyPassword('wrong password', hash)).toBe(false);
    expect(await verifyPassword('anything', 'invalid')).toBe(false);
  });

  it('sets HTTP-only same-site session cookies and clears them safely', () => {
    const response = NextResponse.json({});
    setSessionCookie(response, 'secret', new Date('2030-01-01'));
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
    clearSessionCookie(response);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
