import { NextResponse } from 'next/server';
import { createTripRepository, getDatabase } from '@trip-planner/database';
import { z } from 'zod';

import { auditEvent } from '@/lib/safe-logging';
import { deleteSocialImports } from '@/lib/social-import-store';
import {
  deleteTrip as deleteStoredTrip,
  deletePersistedTripEditorData,
  loadTripEditorData,
  persistTripEditorData,
  renameTrip as renameStoredTrip,
} from '@/lib/trip-editor-store';
import { authorizeTrip } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  if (
    !(await createTripRepository(getDatabase()).deleteTrip(
      auth.user.id,
      tripId,
    ))
  )
    return NextResponse.json({ message: 'Trip not found.' }, { status: 404 });
  deleteStoredTrip(tripId);
  await deletePersistedTripEditorData(tripId);
  deleteSocialImports(tripId);
  auditEvent('trip.deleted', auth.user.id, tripId);
  return new Response(null, { status: 204 });
}

const renameSchema = z.object({ name: z.string().trim().min(1).max(200) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  const parsed = renameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { message: 'Enter a valid map name.' },
      { status: 400 },
    );
  const trip = await createTripRepository(getDatabase()).renameTrip(
    auth.user.id,
    tripId,
    parsed.data.name,
  );
  if (!trip)
    return NextResponse.json({ message: 'Map not found.' }, { status: 404 });
  await loadTripEditorData(tripId);
  renameStoredTrip(tripId, trip.name);
  await persistTripEditorData(tripId);
  return NextResponse.json(trip);
}
