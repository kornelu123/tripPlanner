import { NextResponse } from 'next/server';

import { addTripPoint, getTripEditorData } from '@/lib/trip-editor-store';
import { parseJson, pointDraftSchema } from '@/lib/api-schemas';
import { authorizeTrip } from '@/lib/auth';

interface Context {
  params: Promise<{ tripId: string }>;
}

export async function GET(request: Request, { params }: Context) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId);
  if (auth.error) return auth.error;
  return NextResponse.json(getTripEditorData(tripId));
}

export async function POST(request: Request, { params }: Context) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  const draft = await parseJson(request, pointDraftSchema);
  if (!draft) {
    return NextResponse.json(
      { message: 'A name, address, and coordinates are required.' },
      { status: 400 },
    );
  }
  return NextResponse.json(addTripPoint(tripId, draft), { status: 201 });
}
