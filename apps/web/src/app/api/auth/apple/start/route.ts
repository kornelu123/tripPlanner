import { readAuthEnvironment } from '@trip-planner/config';
import { NextResponse } from 'next/server';
import {
  authRepository,
  challengeLifetimeMs,
  currentSession,
  randomToken,
  tokenHash,
} from '@/lib/auth';

export async function GET(request: Request) {
  const env = readAuthEnvironment();
  if (!env.APPLE_CLIENT_ID)
    return NextResponse.json(
      { message: 'Apple login is not configured.' },
      { status: 503 },
    );
  const state = randomToken();
  const session = await currentSession(request);
  await authRepository().saveChallenge({
    kind: 'apple-oauth',
    challengeHash: tokenHash(state),
    userId: session?.user.id,
    expiresAt: new Date(Date.now() + challengeLifetimeMs),
  });
  const url = new URL('https://appleid.apple.com/auth/authorize');
  url.search = new URLSearchParams({
    client_id: env.APPLE_CLIENT_ID,
    redirect_uri: new URL('/api/auth/apple/callback', env.APP_URL).toString(),
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  }).toString();
  return NextResponse.redirect(url);
}
