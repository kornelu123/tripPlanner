import { NextResponse } from 'next/server';

import { auditEvent } from '@/lib/safe-logging';
import { deleteSocialImports } from '@/lib/social-import-store';
import { deleteTrip } from '@/lib/trip-editor-store';
import { authorizeTrip } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  if (!deleteTrip(tripId))
    return NextResponse.json({ message: 'Trip not found.' }, { status: 404 });
  deleteSocialImports(tripId);
  auditEvent('trip.deleted', auth.user.id, tripId);
  return new Response(null, { status: 204 });
}
