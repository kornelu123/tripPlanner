import { NextResponse } from 'next/server';

import {
  authenticatedUserId,
  categoryInput,
} from '../../../lib/category-validation';
import {
  addCategory,
  canEditTrip,
  listCategories,
} from '../../../lib/trip-editor-store';

function tripIdFrom(request: Request) {
  return new URL(request.url).searchParams.get('tripId')?.trim();
}

export function GET(request: Request) {
  const userId = authenticatedUserId(request);
  if (!userId)
    return NextResponse.json(
      { message: 'Authentication required.' },
      { status: 401 },
    );
  const tripId = tripIdFrom(request);
  if (!tripId)
    return NextResponse.json(
      { message: 'tripId is required.' },
      { status: 400 },
    );
  if (!canEditTrip(tripId, userId))
    return NextResponse.json({ message: 'Trip not found.' }, { status: 404 });
  return NextResponse.json(listCategories(tripId));
}

export async function POST(request: Request) {
  const userId = authenticatedUserId(request);
  if (!userId)
    return NextResponse.json(
      { message: 'Authentication required.' },
      { status: 401 },
    );
  const tripId = tripIdFrom(request);
  const input = categoryInput(await request.json());
  if (!tripId || !input)
    return NextResponse.json(
      { message: 'A valid name, color, and icon are required.' },
      { status: 400 },
    );
  if (!canEditTrip(tripId, userId))
    return NextResponse.json({ message: 'Trip not found.' }, { status: 404 });
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
