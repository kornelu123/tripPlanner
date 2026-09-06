import { NextResponse } from 'next/server';
import {
  authRepository,
  rotateSession,
  setSessionCookie,
  tokenHash,
} from '@/lib/auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const token = url.searchParams.get('token');
  if (!id || !token)
    return NextResponse.json(
      { message: 'Invalid recovery link.' },
      { status: 400 },
    );
  const challenge = await authRepository().consumeChallenge(
    id,
    'magic-link',
    tokenHash(token),
  );
  if (!challenge?.userId)
    return NextResponse.json(
      { message: 'Recovery link expired or was already used.' },
      { status: 410 },
    );
  const session = await rotateSession(request, challenge.userId);
  const response = NextResponse.redirect(new URL('/account', request.url));
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
