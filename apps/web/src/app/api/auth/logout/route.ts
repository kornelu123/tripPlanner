import { NextResponse } from 'next/server';
import { authRepository, clearSessionCookie, currentSession } from '@/lib/auth';
export async function POST(request: Request) {
  const session = await currentSession(request);
  if (session)
    await authRepository().revokeSession(session.user.id, session.session.id);
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
