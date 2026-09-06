import { NextResponse } from 'next/server';

import { categoryInput } from '../../../lib/category-validation';
import { authorizeTrip } from '../../../lib/auth';
import { addCategory, listCategories } from '../../../lib/trip-editor-store';

function tripIdFrom(request: Request) {
  return new URL(request.url).searchParams.get('tripId')?.trim();
}

export async function GET(request: Request) {
  const tripId = tripIdFrom(request);
  if (!tripId)
    return NextResponse.json(
      { message: 'tripId is required.' },
      { status: 400 },
    );
  const auth = await authorizeTrip(request, tripId);
  if (auth.error) return auth.error;
  return NextResponse.json(listCategories(tripId));
}

export async function POST(request: Request) {
  const tripId = tripIdFrom(request);
  const input = categoryInput(await request.json());
  if (!tripId || !input)
    return NextResponse.json(
      { message: 'A valid name, color, and icon are required.' },
      { status: 400 },
    );
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  if (
    listCategories(tripId).some(
      ({ name }) => name.toLowerCase() === input.name.toLowerCase(),
    )
  )
    return NextResponse.json(
      { message: 'Category names must be unique.' },
      { status: 409 },
    );
  return NextResponse.json(addCategory(tripId, input), { status: 201 });
}
