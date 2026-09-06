import { routeOptimizer, UnreachableRouteError } from '@trip-planner/domain';
import { NextResponse } from 'next/server';

import {
  OsrmRoutingProvider,
  RoutingProviderError,
} from '../../../../../lib/osrm-routing-provider';
import {
  getTripEditorData,
  restorePreviousRoutePlan,
  saveRoutePlan,
} from '../../../../../lib/trip-editor-store';
import type {
  RoutePlan,
  RoutePlanRequest,
} from '../../../../../lib/trip-editor-types';
import { authorizeTrip } from '../../../../../lib/auth';
import { parseJson, routePlanSchema } from '../../../../../lib/api-schemas';

interface Context {
  params: Promise<{ tripId: string }>;
}

export async function GET(request: Request, { params }: Context) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId);
  if (auth.error) return auth.error;
  const { routePlan, previousRoutePlan } = getTripEditorData(tripId);
  return NextResponse.json({ routePlan, previousRoutePlan });
}

export async function PATCH(request: Request, { params }: Context) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  const restored = restorePreviousRoutePlan(tripId);
  return restored
    ? NextResponse.json(restored)
    : NextResponse.json(
        { message: 'There is no previous saved route.' },
        { status: 404 },
      );
}

export async function POST(request: Request, { params }: Context) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  const input = (await parseJson(request, routePlanSchema)) as
    | RoutePlanRequest
    | undefined;
  const data = getTripEditorData(tripId);
  if (
    !input ||
    !Array.isArray(input.pointIds) ||
    input.pointIds.length < 2 ||
    new Set(input.pointIds).size !== input.pointIds.length ||
    !['walking', 'driving'].includes(input.mode) ||
    typeof input.roundTrip !== 'boolean' ||
    input.pointIds.some(
      (id) => !data.points.some((point) => point.id === id),
    ) ||
    (input.fixedStartId !== undefined &&
      !input.pointIds.includes(input.fixedStartId)) ||
    (input.fixedEndId !== undefined &&
      !input.pointIds.includes(input.fixedEndId)) ||
    (input.fixedStartId !== undefined &&
      input.fixedStartId === input.fixedEndId) ||
    (input.roundTrip && input.fixedEndId !== undefined)
  ) {
    return NextResponse.json(
      { message: 'Invalid route options or point IDs.' },
      { status: 400 },
    );
  }

  const selected = input.pointIds.map(
    (id) => data.points.find((point) => point.id === id)!,
  );
  const provider = new OsrmRoutingProvider();
  try {
    const matrix = await provider.durationMatrix(selected, input.mode);
    const optimized =
      input.optimize === false
        ? {
            order: selected.map((_, index) => index),
            method: 'manual' as const,
          }
        : routeOptimizer.optimize({
            durations: matrix.durations,
            roundTrip: input.roundTrip,
            fixedStart:
              input.fixedStartId === undefined
                ? undefined
                : input.pointIds.indexOf(input.fixedStartId),
            fixedEnd:
              input.fixedEndId === undefined
                ? undefined
                : input.pointIds.indexOf(input.fixedEndId),
          });
    const ordered = optimized.order.map((index) => selected[index]!);
    const legPoints = input.roundTrip ? [...ordered, ordered[0]!] : ordered;
    const legs: RoutePlan['legs'] = [];
    for (let index = 1; index < legPoints.length; index++) {
      const from = legPoints[index - 1]!;
      const to = legPoints[index]!;
      const route = await provider.calculateRoute({
        origin: from,
        destination: to,
        mode: input.mode,
      });
      legs.push({
        fromPointId: from.id,
        toPointId: to.id,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        geometry: route.path,
      });
    }
    const plan: RoutePlan = {
      id: crypto.randomUUID(),
      pointIds: ordered.map(({ id }) => id),
      mode: input.mode,
      roundTrip: input.roundTrip,
      fixedStartId: input.fixedStartId,
      fixedEndId: input.fixedEndId,
      totalDistanceMeters: legs.reduce(
        (total, leg) => total + leg.distanceMeters,
        0,
      ),
      totalDurationSeconds: legs.reduce(
        (total, leg) => total + leg.durationSeconds,
        0,
      ),
      optimizationMethod: optimized.method,
      provider: matrix.metadata,
      legs,
    };
    return NextResponse.json(saveRoutePlan(tripId, plan), { status: 201 });
  } catch (error) {
    if (
      error instanceof UnreachableRouteError ||
      (error instanceof RoutingProviderError && error.kind === 'unreachable')
    ) {
      return NextResponse.json(
        { message: error.message, code: 'UNREACHABLE_STOPS' },
        { status: 422 },
      );
    }
    return NextResponse.json(
      {
        message: 'The routing provider could not complete every route leg.',
        code: 'PROVIDER_FAILURE',
      },
      { status: 502 },
    );
  }
}
