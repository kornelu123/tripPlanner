import { createTripRepository, getDatabase } from '@trip-planner/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticated } from '@/lib/auth';
import { renameTrip } from '@/lib/trip-editor-store';

const tripSchema = z.object({ name: z.string().trim().min(1).max(200) });

export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  return NextResponse.json(
    await createTripRepository(getDatabase()).listTrips(auth.user.id),
  );
}

export async function POST(request: Request) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const parsed = tripSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { message: 'Enter a map name between 1 and 200 characters.' },
      { status: 400 },
    );
  const trip = await createTripRepository(getDatabase()).createTrip(
    auth.user.id,
    parsed.data.name,
  );
  if (!trip)
    return NextResponse.json(
      { message: 'Could not create map.' },
      { status: 500 },
    );
  renameTrip(trip.id, trip.name);
  return NextResponse.json({ ...trip, role: 'owner' }, { status: 201 });
}
