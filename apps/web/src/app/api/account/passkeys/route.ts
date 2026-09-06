import { NextResponse } from 'next/server';
import { authRepository, authenticated } from '@/lib/auth';
export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const credentials = await authRepository().listPasskeys(auth.user.id);
  return NextResponse.json(
    credentials.map(
      ({ id, name, deviceType, backedUp, createdAt, lastUsedAt }) => ({
        id,
        name,
        deviceType,
        backedUp,
        createdAt,
        lastUsedAt,
      }),
    ),
  );
}
