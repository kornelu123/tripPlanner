import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';

import {
  authenticated,
  authRepository,
  challengeLifetimeMs,
  normalizeEmail,
  tokenHash,
  webAuthnConfig,
} from '@/lib/auth';

export async function POST(request: Request) {
  const existing = await authenticated(request);
  let user = existing.error ? null : existing.user;
  if (!user) {
    const input = (await request.json()) as {
      email?: unknown;
      displayName?: unknown;
    };
    if (
      typeof input.email !== 'string' ||
      typeof input.displayName !== 'string' ||
      !input.displayName.trim()
    )
      return NextResponse.json(
        { message: 'Email and name are required.' },
        { status: 400 },
      );
    const email = normalizeEmail(input.email);
    if (!/^\S+@\S+\.\S+$/.test(email))
      return NextResponse.json(
        { message: 'Enter a valid email.' },
        { status: 400 },
      );
    if (await authRepository().findUserByEmail(email)) {
      return NextResponse.json(
        { message: 'Sign in before adding a passkey to this account.' },
        { status: 409 },
      );
    }
    user = await authRepository().createUser(
      email,
      input.displayName.trim().slice(0, 200),
    );
  }
  const credentials = await authRepository().listPasskeys(user.id);
  const options = await generateRegistrationOptions({
    ...webAuthnConfig(),
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.displayName,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
    excludeCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: credential.transports as AuthenticatorTransport[],
    })),
  });
  const record = await authRepository().saveChallenge({
    kind: 'passkey-registration',
    challengeHash: tokenHash(options.challenge),
    userId: user.id,
    expiresAt: new Date(Date.now() + challengeLifetimeMs),
  });
  return NextResponse.json({ challengeId: record.id, options });
}
