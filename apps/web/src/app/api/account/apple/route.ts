import { NextResponse } from 'next/server';
import {
  authRepository,
  authenticated,
  rotateSession,
  setSessionCookie,
} from '@/lib/auth';
export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const account = await authRepository().findAppleAccountForUser(auth.user.id);
  return NextResponse.json(
    account
      ? {
          linked: true,
          email: account.email,
          isPrivateRelay: account.isPrivateRelay,
        }
      : { linked: false },
  );
}
export async function DELETE(request: Request) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  if ((await authRepository().listPasskeys(auth.user.id)).length === 0)
    return NextResponse.json(
      { message: 'Register a passkey before unlinking Apple.' },
      { status: 409 },
    );
  await authRepository().unlinkApple(auth.user.id);
  const rotated = await rotateSession(request, auth.user.id);
  const response = new NextResponse(null, { status: 204 });
  setSessionCookie(response, rotated.token, rotated.expiresAt);
  return response;
}
