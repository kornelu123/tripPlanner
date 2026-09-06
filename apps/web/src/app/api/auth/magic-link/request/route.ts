import { readAuthEnvironment } from '@trip-planner/config';
import { NextResponse } from 'next/server';
import {
  authRepository,
  normalizeEmail,
  randomToken,
  tokenHash,
} from '@/lib/auth';
import { sendMagicLink } from '@/lib/email';

export async function POST(request: Request) {
  const input = (await request.json()) as { email?: unknown };
  if (typeof input.email !== 'string')
    return NextResponse.json(
      { message: 'Email is required.' },
      { status: 400 },
    );
  const email = normalizeEmail(input.email);
  const user = await authRepository().findUserByEmail(email);
  if (user) {
    const token = randomToken();
    const record = await authRepository().saveChallenge({
      kind: 'magic-link',
      challengeHash: tokenHash(token),
      userId: user.id,
      email,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const url = new URL(
      '/api/auth/magic-link/verify',
      readAuthEnvironment().APP_URL,
    );
    url.searchParams.set('id', record.id);
    url.searchParams.set('token', token);
    await sendMagicLink(email, url.toString());
  }
  return NextResponse.json(
    { message: 'If that account exists, a sign-in link is on its way.' },
    { status: 202 },
  );
}
