import { z } from 'zod';
import { NextResponse } from 'next/server';

import {
  authRepository,
  normalizeEmail,
  rotateSession,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { reportError } from '@/lib/safe-logging';

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { message: 'Enter a valid email and password.' },
      { status: 400 },
    );

  try {
    const repository = authRepository();
    const user = await repository.findUserByEmail(
      normalizeEmail(parsed.data.email),
    );
    if (
      !user?.passwordHash ||
      !(await verifyPassword(parsed.data.password, user.passwordHash))
    )
      return NextResponse.json(
        { message: 'Email or password is incorrect.' },
        { status: 401 },
      );

    const session = await rotateSession(request, user.id);
    await repository.recordAuditEvent('login.succeeded', user.id, user.id);
    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
    });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    reportError(error, { route: 'auth.login' });
    return NextResponse.json(
      { message: 'Could not log in. Please try again.' },
      { status: 500 },
    );
  }
}
