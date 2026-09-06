import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
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
    response?: AuthenticationResponseJSON;
  };
  if (!input.challengeId || !input.response)
    return NextResponse.json(
      { message: 'Login was cancelled or incomplete.' },
      { status: 400 },
    );
  const credential = await authRepository().findPasskey(input.response.id);
  if (!credential)
    return NextResponse.json(
      { message: 'Passkey not recognized.' },
      { status: 401 },
    );
  let challenge: string;
  try {
    challenge = JSON.parse(
      Buffer.from(
        input.response.response.clientDataJSON,
        'base64url',
      ).toString(),
    ).challenge;
  } catch {
    return NextResponse.json(
      { message: 'Invalid credential response.' },
      { status: 400 },
    );
  }
  const stored = await authRepository().consumeChallenge(
    input.challengeId,
    'passkey-login',
    tokenHash(challenge),
  );
  if (!stored)
    return NextResponse.json(
      { message: 'Login challenge expired or was already used.' },
      { status: 410 },
    );
  try {
    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: challenge,
      expectedOrigin: webAuthnConfig().origin,
      expectedRPID: webAuthnConfig().rpID,
      requireUserVerification: true,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransport[],
      },
    });
    if (!verification.verified) throw new Error('Not verified');
    await authRepository().updatePasskeyCounter(
      credential.id,
      verification.authenticationInfo.newCounter,
    );
    const session = await rotateSession(request, credential.userId);
    const response = NextResponse.json({ verified: true });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch {
    return NextResponse.json(
      { message: 'Passkey verification failed.' },
      { status: 401 },
    );
  }
}
