import { NextResponse } from 'next/server';

import { deleteTripPoint, updateTripPoint } from '@/lib/trip-editor-store';
import type { TripPoint } from '@/lib/trip-editor-types';

interface Context {
  params: Promise<{ tripId: string; pointId: string }>;
}

export async function PATCH(request: Request, { params }: Context) {
  const { tripId, pointId } = await params;
  const update = (await request.json()) as Partial<TripPoint>;
  const point = updateTripPoint(tripId, pointId, update);
  return point
    ? NextResponse.json(point)
    : NextResponse.json({ message: 'Point not found.' }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { tripId, pointId } = await params;
  return new Response(null, {
    status: deleteTripPoint(tripId, pointId) ? 204 : 404,
  });
}
