import { z } from 'zod';
import { NextResponse } from 'next/server';

import {
  authRepository,
  hashPassword,
  normalizeEmail,
  rotateSession,
  setSessionCookie,
} from '@/lib/auth';

const registrationSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  displayName: z.string().trim().min(1).max(200),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        message:
          'Enter a valid name, email, and password of at least 8 characters.',
      },
      { status: 400 },
    );

  const email = normalizeEmail(parsed.data.email);
  const repository = authRepository();
  if (await repository.findUserByEmail(email))
    return NextResponse.json(
      { message: 'An account with that email already exists.' },
      { status: 409 },
    );

  const user = await repository.createUser(
    email,
    parsed.data.displayName,
    await hashPassword(parsed.data.password),
  );
  const session = await rotateSession(request, user.id);
  await repository.recordAuditEvent('account.created', user.id, user.id);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email },
  });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
