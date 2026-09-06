import { getRedisClient } from '@trip-planner/database';
import { NextResponse } from 'next/server';

import { authorizeTrip } from '@/lib/auth';
import { PriceLookupCoordinator } from '@/lib/price-research';
import { enqueuePriceResearch } from '@/lib/price-research-worker';
import { findTripPoint } from '@/lib/trip-editor-store';
import { PriceResearchService } from '@trip-planner/domain';

interface Context {
  params: Promise<{ tripId: string; pointId: string }>;
}

export async function POST(request: Request, { params }: Context) {
  const { tripId, pointId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  if (!findTripPoint(tripId, pointId))
    return NextResponse.json({ message: 'Point not found.' }, { status: 404 });
  try {
    const coordinator = new PriceLookupCoordinator(
      new PriceResearchService([]),
      await getRedisClient(),
    );
    await coordinator.assertRefreshAllowed(auth.user.id, pointId);
  } catch (error) {
    if ((error as Error).message === 'RATE_LIMITED')
      return NextResponse.json(
        { message: 'Price refresh limit reached. Try again later.' },
        { status: 429 },
      );
    return NextResponse.json(
      { message: 'Price research is temporarily unavailable.' },
      { status: 503 },
    );
  }
  enqueuePriceResearch(tripId, pointId);
  return NextResponse.json({ status: 'queued' }, { status: 202 });
}
