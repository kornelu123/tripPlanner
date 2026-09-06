import { NextResponse } from 'next/server';

import { deleteTripPoint, updateTripPoint } from '@/lib/trip-editor-store';
import { parseJson, pointUpdateSchema } from '@/lib/api-schemas';
import { authorizeTrip } from '@/lib/auth';

interface Context {
  params: Promise<{ tripId: string; pointId: string }>;
}

export async function PATCH(request: Request, { params }: Context) {
  const { tripId, pointId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  const update = await parseJson(request, pointUpdateSchema);
  if (!update)
    return NextResponse.json(
      { message: 'Invalid point update.' },
      { status: 400 },
    );
  const point = updateTripPoint(tripId, pointId, update);
  return point
    ? NextResponse.json(point)
    : NextResponse.json({ message: 'Point not found.' }, { status: 404 });
}

export async function DELETE(request: Request, { params }: Context) {
  const { tripId, pointId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  return new Response(null, {
    status: deleteTripPoint(tripId, pointId) ? 204 : 404,
  });
}
