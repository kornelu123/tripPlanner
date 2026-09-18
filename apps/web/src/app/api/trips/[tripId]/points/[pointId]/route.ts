import { NextResponse } from 'next/server';

import {
  deleteTripPoint,
  loadTripEditorData,
  persistTripEditorData,
  updateTripPoint,
} from '@/lib/trip-editor-store';
import { parseJson, pointUpdateSchema } from '@/lib/api-schemas';
import { authorizeTrip } from '@/lib/auth';

interface Context {
  params: Promise<{ tripId: string; pointId: string }>;
}

export async function PATCH(request: Request, { params }: Context) {
  const { tripId, pointId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  await loadTripEditorData(tripId);
  const update = await parseJson(request, pointUpdateSchema);
  if (!update)
    return NextResponse.json(
      { message: 'Invalid point update.' },
      { status: 400 },
    );
  const point = updateTripPoint(tripId, pointId, update);
  if (point) await persistTripEditorData(tripId);
  return point
    ? NextResponse.json(point)
    : NextResponse.json({ message: 'Point not found.' }, { status: 404 });
}

export async function DELETE(request: Request, { params }: Context) {
  const { tripId, pointId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  await loadTripEditorData(tripId);
  const deleted = deleteTripPoint(tripId, pointId);
  if (deleted) await persistTripEditorData(tripId);
  return new Response(null, {
    status: deleted ? 204 : 404,
  });
}
