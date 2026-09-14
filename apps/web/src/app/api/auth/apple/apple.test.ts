import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appleClientSecret: vi.fn(),
  createUser: vi.fn(),
  currentSession: vi.fn(),
  findAppleAccount: vi.fn(),
  findUserByEmail: vi.fn(),
  linkApple: vi.fn(),
  recordAuditEvent: vi.fn(),
  rotateSession: vi.fn(),
  saveChallenge: vi.fn(),
  consumeChallengeByHash: vi.fn(),
  verifyAppleIdentityToken: vi.fn(),
}));

vi.mock('@trip-planner/config', () => ({
  readAuthEnvironment: () => ({
    APP_URL: 'https://trips.example.com',
    WEBAUTHN_RP_ID: 'trips.example.com',
    APPLE_CLIENT_ID: 'com.example.web',
    APPLE_TEAM_ID: 'TEAM123',
    APPLE_KEY_ID: 'KEY123',
    APPLE_PRIVATE_KEY: 'private-key',
  }),
}));

vi.mock('@/lib/apple', () => ({
  appleClientSecret: mocks.appleClientSecret,
  verifyAppleIdentityToken: mocks.verifyAppleIdentityToken,
}));

vi.mock('@/lib/auth', () => ({
  authRepository: () => ({
    consumeChallengeByHash: mocks.consumeChallengeByHash,
    createUser: mocks.createUser,
    findAppleAccount: mocks.findAppleAccount,
    findAppleAccountForUser: vi.fn(),
    findUserByEmail: mocks.findUserByEmail,
    findUserById: vi.fn(),
    linkApple: mocks.linkApple,
    recordAuditEvent: mocks.recordAuditEvent,
    saveChallenge: mocks.saveChallenge,
  }),
  challengeLifetimeMs: 300_000,
  currentSession: mocks.currentSession,
  isApplePrivateRelay: (email: string) =>
    email.endsWith('@privaterelay.appleid.com'),
  normalizeEmail: (email: string) => email.toLowerCase(),
  randomToken: () => 'apple-state',
  rotateSession: mocks.rotateSession,
  setSessionCookie: (
    response: { cookies: { set: (...input: unknown[]) => void } },
    token: string,
    expiresAt: Date,
  ) => response.cookies.set('__Host-roamly_session', token, { expiresAt }),
  tokenHash: (token: string) => `hash:${token}`,
}));

vi.mock('@/lib/safe-logging', () => ({ reportError: vi.fn() }));

import { POST } from './callback/route';
import { GET } from './start/route';

function callbackRequest(fields: Record<string, string>) {
  return new Request('https://trips.example.com/api/auth/apple/callback', {
    method: 'POST',
    body: new URLSearchParams(fields),
  });
}

describe('Apple authentication routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentSession.mockResolvedValue(null);
    mocks.appleClientSecret.mockResolvedValue('client-secret');
  });

  it('starts Apple authorization with a persisted state challenge', async () => {
    const response = await GET(
      new Request('https://trips.example.com/api/auth/apple/start'),
    );
    const location = new URL(response.headers.get('location')!);

    expect(response.status).toBe(307);
    expect(location.origin).toBe('https://appleid.apple.com');
    expect(location.searchParams.get('client_id')).toBe('com.example.web');
    expect(location.searchParams.get('state')).toBe('apple-state');
    expect(location.searchParams.get('response_mode')).toBe('form_post');
    expect(mocks.saveChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'apple-oauth',
        challengeHash: 'hash:apple-state',
      }),
    );
  });

  it('creates an account and session from a verified Apple callback', async () => {
    const user = {
      id: 'user-1',
      email: 'relay@privaterelay.appleid.com',
    };
    mocks.consumeChallengeByHash.mockResolvedValue({ userId: null });
    mocks.verifyAppleIdentityToken.mockResolvedValue({
      subject: 'apple-subject',
      email: 'Relay@privaterelay.appleid.com',
    });
    mocks.findAppleAccount.mockResolvedValue(null);
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue(user);
    mocks.rotateSession.mockResolvedValue({
      token: 'session-token',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ id_token: 'identity-token' })),
    );

    const response = await POST(
      callbackRequest({
        state: 'apple-state',
        code: 'authorization-code',
        user: JSON.stringify({
          name: { firstName: 'Taylor', lastName: 'Traveler' },
        }),
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://trips.example.com/account',
    );
    expect(mocks.createUser).toHaveBeenCalledWith(
      'relay@privaterelay.appleid.com',
      'Taylor Traveler',
    );
    expect(mocks.linkApple).toHaveBeenCalledWith({
      subject: 'apple-subject',
      userId: 'user-1',
      email: 'relay@privaterelay.appleid.com',
      isPrivateRelay: true,
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      'login.apple_succeeded',
      'user-1',
      'user-1',
    );
    expect(response.headers.get('set-cookie')).toContain('session-token');
    vi.unstubAllGlobals();
  });

  it('rejects a token response without an identity token', async () => {
    mocks.consumeChallengeByHash.mockResolvedValue({ userId: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})));

    const response = await POST(
      callbackRequest({ state: 'apple-state', code: 'authorization-code' }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: 'Apple sign-in could not be verified.',
    });
    expect(mocks.verifyAppleIdentityToken).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
