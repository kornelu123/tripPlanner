import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';

import {
  authRepository,
  rotateSession,
  setSessionCookie,
  tokenHash,
  webAuthnConfig,
} from '@/lib/auth';

export async function POST(request: Request) {
  const input = (await request.json()) as {
    challengeId?: string;
    response?: RegistrationResponseJSON;
    name?: string;
  };
  if (!input.challengeId || !input.response)
    return NextResponse.json(
      { message: 'Registration was cancelled or incomplete.' },
      { status: 400 },
    );
  const clientChallenge = input.response.response.clientDataJSON;
  let challenge: string;
  try {
    challenge = JSON.parse(
      Buffer.from(clientChallenge, 'base64url').toString(),
    ).challenge;
  } catch {
    return NextResponse.json(
      { message: 'Invalid credential response.' },
      { status: 400 },
    );
  }
  const stored = await authRepository().consumeChallenge(
    input.challengeId,
    'passkey-registration',
    tokenHash(challenge),
  );
  if (!stored?.userId)
    return NextResponse.json(
      { message: 'Registration challenge expired or was already used.' },
      { status: 410 },
    );
  try {
    const verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: challenge,
      expectedOrigin: webAuthnConfig().origin,
      expectedRPID: webAuthnConfig().rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo)
      throw new Error('Not verified');
    const { credential, credentialBackedUp, credentialDeviceType } =
      verification.registrationInfo;
    const saved = await authRepository().addPasskey({
      id: credential.id,
      userId: stored.userId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: input.name?.trim().slice(0, 100) || 'Passkey',
    });
    if (!saved)
      return NextResponse.json(
        { message: 'This passkey is already registered.' },
        { status: 409 },
      );
    const session = await rotateSession(request, stored.userId);
    const response = NextResponse.json(
      { verified: true, credential: { id: saved.id, name: saved.name } },
      { status: 201 },
    );
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch {
    return NextResponse.json(
      { message: 'Passkey verification failed.' },
      { status: 400 },
    );
  }
}
