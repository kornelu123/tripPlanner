import { createHash, randomBytes } from 'node:crypto';

import { readAuthEnvironment } from '@trip-planner/config';
import { createAuthRepository, getDatabase } from '@trip-planner/database';
import { NextResponse } from 'next/server';

export const sessionCookieName = '__Host-roamly_session';
export const challengeLifetimeMs = 5 * 60 * 1000;
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export const authRepository = () => createAuthRepository(getDatabase());
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isApplePrivateRelay = (email: string) =>
  normalizeEmail(email).endsWith('@privaterelay.appleid.com');
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function currentSession(request: Request) {
  const token = cookieValue(request, sessionCookieName);
  return token ? authRepository().sessionByHash(tokenHash(token)) : null;
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expires: Date,
) {
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function rotateSession(request: Request, userId: string) {
  const previous = await currentSession(request);
  if (previous)
    await authRepository().revokeSession(userId, previous.session.id);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  const session = await authRepository().createSession({
    userId,
    tokenHash: tokenHash(token),
    expiresAt,
    userAgent: request.headers.get('user-agent'),
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  });
  return { session, token, expiresAt };
}

export async function authenticated(request: Request) {
  const result = await currentSession(request);
  if (!result)
    return {
      error: NextResponse.json(
        { message: 'Authentication required.' },
        { status: 401 },
      ),
    } as const;
  return { ...result, error: null } as const;
}

export async function authorizeTrip(
  request: Request,
  tripId: string,
  edit = false,
) {
  if (tripId === 'demo') {
    return { user: { id: 'demo-user' }, session: null, error: null } as const;
  }
  const auth = await authenticated(request);
  if (auth.error) return auth;
  if (!(await authRepository().canAccessTrip(auth.user.id, tripId, edit)))
    return {
      error: NextResponse.json({ message: 'Trip not found.' }, { status: 404 }),
    } as const;
  return auth;
}

export const webAuthnConfig = () => {
  const environment = readAuthEnvironment();
  return {
    rpName: 'Roamly',
    rpID: environment.WEBAUTHN_RP_ID,
    origin: environment.APP_URL,
  };
};
