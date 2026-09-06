import { readAuthEnvironment } from '@trip-planner/config';
import { NextResponse } from 'next/server';
import { appleClientSecret, verifyAppleIdentityToken } from '@/lib/apple';
import {
  authRepository,
  isApplePrivateRelay,
  normalizeEmail,
  rotateSession,
  setSessionCookie,
  tokenHash,
} from '@/lib/auth';

export async function POST(request: Request) {
  const form = await request.formData();
  const state = form.get('state');
  const code = form.get('code');
  const postedToken = form.get('id_token');
  if (typeof state !== 'string' || typeof code !== 'string')
    return NextResponse.json(
      { message: 'Apple sign-in was cancelled or invalid.' },
      { status: 400 },
    );
  const challenge = await authRepository().consumeChallengeByHash(
    'apple-oauth',
    tokenHash(state),
  );
  if (!challenge)
    return NextResponse.json(
      { message: 'Apple sign-in expired or was already used.' },
      { status: 410 },
    );
  const env = readAuthEnvironment();
  const exchange = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.APPLE_CLIENT_ID!,
      client_secret: await appleClientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: new URL('/api/auth/apple/callback', env.APP_URL).toString(),
    }),
  });
  if (!exchange.ok)
    return NextResponse.json(
      { message: 'Apple sign-in could not be verified.' },
      { status: 401 },
    );
  const tokens = (await exchange.json()) as { id_token?: string };
  const identity = await verifyAppleIdentityToken(
    tokens.id_token ?? (typeof postedToken === 'string' ? postedToken : ''),
  );
  const existing = await authRepository().findAppleAccount(identity.subject);
  let user;
  if (challenge.userId) {
    if (existing && existing.userId !== challenge.userId)
      return NextResponse.json(
        { message: 'That Apple login belongs to another account.' },
        { status: 409 },
      );
    const alreadyLinked = await authRepository().findAppleAccountForUser(
      challenge.userId,
    );
    if (alreadyLinked && alreadyLinked.subject !== identity.subject)
      return NextResponse.json(
        { message: 'This account already has an Apple login.' },
        { status: 409 },
      );
    user = await authRepository().findUserById(challenge.userId);
    if (!existing)
      await authRepository().linkApple({
        subject: identity.subject,
        userId: challenge.userId,
        email: normalizeEmail(identity.email),
        isPrivateRelay: isApplePrivateRelay(identity.email),
      });
  } else if (existing)
    user = await authRepository().findUserById(existing.userId);
  else {
    const email = normalizeEmail(identity.email);
    if (await authRepository().findUserByEmail(email))
      return NextResponse.json(
        { message: 'Sign in first, then link Apple from account settings.' },
        { status: 409 },
      );
    let displayName = 'Apple user';
    const profile = form.get('user');
    if (typeof profile === 'string') {
      try {
        const name = (
          JSON.parse(profile) as {
            name?: { firstName?: string; lastName?: string };
          }
        ).name;
        displayName =
          [name?.firstName, name?.lastName].filter(Boolean).join(' ') ||
          displayName;
      } catch {}
    }
    user = await authRepository().createUser(email, displayName);
    await authRepository().linkApple({
      subject: identity.subject,
      userId: user.id,
      email,
      isPrivateRelay: isApplePrivateRelay(email),
    });
  }
  if (!user)
    return NextResponse.json(
      { message: 'Apple account could not be loaded.' },
      { status: 401 },
    );
  const session = await rotateSession(request, user.id);
  const response = NextResponse.redirect(new URL('/account', env.APP_URL));
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
