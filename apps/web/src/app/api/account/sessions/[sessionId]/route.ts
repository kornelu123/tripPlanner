import { NextResponse } from 'next/server';
import {
  authRepository,
  authenticated,
  clearSessionCookie,
  rotateSession,
  setSessionCookie,
} from '@/lib/auth';
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const { sessionId } = await params;
  await authRepository().revokeSession(auth.user.id, sessionId);
  const response = new NextResponse(null, { status: 204 });
  if (sessionId === auth.session.id) clearSessionCookie(response);
  else {
    const rotated = await rotateSession(request, auth.user.id);
    setSessionCookie(response, rotated.token, rotated.expiresAt);
  }
  return response;
}
