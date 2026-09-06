import { NextResponse } from 'next/server';
import {
  authRepository,
  authenticated,
  rotateSession,
  setSessionCookie,
} from '@/lib/auth';
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ credentialId: string }> },
) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const keys = await authRepository().listPasskeys(auth.user.id);
  const apple = await authRepository().findAppleAccountForUser(auth.user.id);
  if (keys.length <= 1 && !apple)
    return NextResponse.json(
      { message: 'Add another sign-in method before removing this passkey.' },
      { status: 409 },
    );
  const removed = await authRepository().deletePasskey(
    auth.user.id,
    (await params).credentialId,
  );
  if (!removed)
    return NextResponse.json(
      { message: 'Passkey not found.' },
      { status: 404 },
    );
  await authRepository().recordAuditEvent(
    'credential.passkey_removed',
    auth.user.id,
  );
  const rotated = await rotateSession(request, auth.user.id);
  const response = new NextResponse(null, { status: 204 });
  setSessionCookie(response, rotated.token, rotated.expiresAt);
  return response;
}
