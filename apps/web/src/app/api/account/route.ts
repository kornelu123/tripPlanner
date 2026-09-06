import { NextResponse } from 'next/server';

import { authRepository, authenticated, clearSessionCookie } from '@/lib/auth';
import { auditEvent } from '@/lib/safe-logging';

export async function DELETE(request: Request) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  await authRepository().recordAuditEvent(
    'account.deleted',
    auth.user.id,
    auth.user.id,
  );
  await authRepository().deleteUser(auth.user.id);
  auditEvent('account.deleted', auth.user.id, auth.user.id);
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
