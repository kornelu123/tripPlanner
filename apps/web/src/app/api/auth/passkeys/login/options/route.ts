import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import {
  authRepository,
  challengeLifetimeMs,
  tokenHash,
  webAuthnConfig,
} from '@/lib/auth';

export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: webAuthnConfig().rpID,
    userVerification: 'required',
  });
  const record = await authRepository().saveChallenge({
    kind: 'passkey-login',
    challengeHash: tokenHash(options.challenge),
    expiresAt: new Date(Date.now() + challengeLifetimeMs),
  });
  return NextResponse.json({ challengeId: record.id, options });
}
