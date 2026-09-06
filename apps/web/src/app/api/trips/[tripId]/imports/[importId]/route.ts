import { NextResponse } from 'next/server';

import { addTripPoint } from '../../../../../../lib/trip-editor-store';
import {
  getSocialImport,
  saveSocialImport,
} from '../../../../../../lib/social-import-store';
import { transitionSocialImport } from '@trip-planner/domain';

interface Context {
  params: Promise<{ tripId: string; importId: string }>;
}

export async function GET(_request: Request, { params }: Context) {
  const { tripId, importId } = await params;
  const item = getSocialImport(tripId, importId);
  return item
    ? NextResponse.json(item)
    : NextResponse.json({ message: 'Import not found.' }, { status: 404 });
}

export async function POST(request: Request, { params }: Context) {
  const { tripId, importId } = await params;
  const item = getSocialImport(tripId, importId);
  if (!item)
    return NextResponse.json({ message: 'Import not found.' }, { status: 404 });
  if (item.status !== 'needs_confirmation')
    return NextResponse.json(
      { message: 'Wait for candidates before confirming.' },
      { status: 409 },
    );
  const input = (await request.json()) as {
    candidateId?: string;
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  const candidate = item.candidates.find(({ id }) => id === input.candidateId);
  const draft = candidate
    ? {
        name: candidate.name,
        address: candidate.address,
        latitude: candidate.position.latitude,
        longitude: candidate.position.longitude,
      }
    : input;
  if (
    !draft.name ||
    !draft.address ||
    !Number.isFinite(draft.latitude) ||
    !Number.isFinite(draft.longitude)
  )
    return NextResponse.json(
      { message: 'Select a candidate or provide a complete edited location.' },
      { status: 400 },
    );
  const point = addTripPoint(tripId, {
    name: draft.name,
    address: draft.address,
    latitude: draft.latitude!,
    longitude: draft.longitude!,
  });
  saveSocialImport({
    ...transitionSocialImport(item, 'completed'),
    candidates: [],
  });
  return NextResponse.json(point, { status: 201 });
}
