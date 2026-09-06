import { NextResponse } from 'next/server';

import {
  authenticated,
  authRepository,
  rotateSession,
  setSessionCookie,
} from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const sessions = await authRepository().listSessions(auth.user.id);
  return NextResponse.json(
    sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      current: session.id === auth.session.id,
    })),
  );
}

export async function DELETE(request: Request) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  await authRepository().revokeOtherSessions(auth.user.id, auth.session.id);
  const rotated = await rotateSession(request, auth.user.id);
  const response = new NextResponse(null, { status: 204 });
  setSessionCookie(response, rotated.token, rotated.expiresAt);
  return response;
}
