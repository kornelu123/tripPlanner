import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  recordAuditEvent: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  rotateSession: vi.fn(),
  setSessionCookie: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock('@/lib/safe-logging', () => ({ reportError: mocks.reportError }));

vi.mock('@/lib/auth', () => ({
  authRepository: () => ({
    findUserByEmail: mocks.findUserByEmail,
    createUser: mocks.createUser,
    recordAuditEvent: mocks.recordAuditEvent,
  }),
  hashPassword: mocks.hashPassword,
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  rotateSession: mocks.rotateSession,
  setSessionCookie: mocks.setSessionCookie,
  verifyPassword: mocks.verifyPassword,
}));

import { POST as login } from './login/route';
import { POST as register } from './register/route';

function request(path: string, body: unknown) {
  return new Request(`http://localhost/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('password authentication routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue('stored-hash');
    mocks.rotateSession.mockResolvedValue({
      token: 'session-token',
      expiresAt: new Date('2030-01-01'),
    });
  });

  it('registers a normalized account and starts a session', async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({
      id: 'user-id',
      email: 'person@example.com',
    });

    const response = await register(
      request('register', {
        email: ' Person@Example.com ',
        displayName: 'Person',
        password: 'password123',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createUser).toHaveBeenCalledWith(
      'person@example.com',
      'Person',
      'stored-hash',
    );
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(
      response,
      'session-token',
      new Date('2030-01-01'),
    );
  });

  it('rejects duplicate registrations and invalid credentials', async () => {
    mocks.findUserByEmail.mockResolvedValueOnce({ id: 'existing' });
    expect(
      (
        await register(
          request('register', {
            email: 'person@example.com',
            displayName: 'Person',
            password: 'password123',
          }),
        )
      ).status,
    ).toBe(409);

    mocks.findUserByEmail.mockResolvedValueOnce(null);
    expect(
      (
        await login(
          request('login', {
            email: 'person@example.com',
            password: 'wrong-password',
          }),
        )
      ).status,
    ).toBe(401);
  });

  it('logs in users with a valid password and starts a session', async () => {
    mocks.findUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'person@example.com',
      passwordHash: 'stored-hash',
    });
    mocks.verifyPassword.mockResolvedValue(true);

    const response = await login(
      request('login', {
        email: 'Person@Example.com',
        password: 'password123',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.verifyPassword).toHaveBeenCalledWith(
      'password123',
      'stored-hash',
    );
    expect(mocks.rotateSession).toHaveBeenCalledWith(
      expect.any(Request),
      'user-id',
    );
  });

  it('returns JSON when authentication infrastructure fails', async () => {
    mocks.findUserByEmail.mockRejectedValue(new Error('database unavailable'));

    const response = await register(
      request('register', {
        email: 'person@example.com',
        displayName: 'Person',
        password: 'password123',
      }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      message: 'Could not create account. Please try again.',
    });
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), {
      route: 'auth.register',
    });
  });
});
