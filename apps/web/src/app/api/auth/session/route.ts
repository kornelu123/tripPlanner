import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/auth';
export async function GET(request: Request) {
  const auth = await authenticated(request);
  return (
    auth.error ??
    NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        displayName: auth.user.displayName,
      },
      sessionId: auth.session.id,
    })
  );
}
