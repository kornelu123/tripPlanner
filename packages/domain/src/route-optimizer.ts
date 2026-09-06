import type {
  OptimizedRoute,
  RouteOptimizationRequest,
  RouteOptimizer,
} from './providers';
import { UnreachableRouteError } from './providers';

const EXACT_LIMIT = 10;
const HEURISTIC_PASSES = 20;

function routeCost(
  order: number[],
  durations: (number | null)[][],
  roundTrip: boolean,
): number {
  let total = 0;
  const route = roundTrip ? [...order, order[0]!] : order;
  for (let index = 1; index < route.length; index++) {
    const duration = durations[route[index - 1]!]?.[route[index]!];
    if (duration == null || !Number.isFinite(duration)) return Infinity;
    total += duration;
  }
  return total;
}

function assertRequest(request: RouteOptimizationRequest) {
  const size = request.durations.length;
  if (
    size < 2 ||
    request.durations.some((row) => row.length !== size) ||
    (request.fixedStart !== undefined &&
      request.fixedStart === request.fixedEnd)
  ) {
    throw new Error('A square matrix with distinct endpoints is required.');
  }
  for (const endpoint of [request.fixedStart, request.fixedEnd]) {
    if (endpoint !== undefined && (endpoint < 0 || endpoint >= size)) {
      throw new Error('A fixed endpoint is outside the matrix.');
    }
  }
  if (request.roundTrip && request.fixedEnd !== undefined) {
    throw new Error('A round trip cannot have a fixed end.');
  }
}

function exact(request: RouteOptimizationRequest): OptimizedRoute {
  const size = request.durations.length;
  const starts =
    request.fixedStart === undefined
      ? Array.from({ length: size }, (_, index) => index)
      : [request.fixedStart];
  let bestOrder: number[] | undefined;
  let bestCost = Infinity;

  function visit(order: number[], remaining: number[]) {
    if (!remaining.length) {
      if (request.fixedEnd !== undefined && order.at(-1) !== request.fixedEnd)
        return;
      const cost = routeCost(order, request.durations, request.roundTrip);
      if (cost < bestCost) {
        bestCost = cost;
        bestOrder = order;
      }
      return;
    }
    if (routeCost(order, request.durations, false) >= bestCost) return;
    for (const next of remaining) {
      if (next === request.fixedEnd && remaining.length > 1) continue;
      visit(
        [...order, next],
        remaining.filter((candidate) => candidate !== next),
      );
    }
  }

  for (const start of starts) {
    if (start === request.fixedEnd) continue;
    visit(
      [start],
      Array.from({ length: size }, (_, index) => index).filter(
        (index) => index !== start,
      ),
    );
  }
  if (!bestOrder) throw new UnreachableRouteError();
  return { order: bestOrder, durationSeconds: bestCost, method: 'exact' };
}

function heuristic(request: RouteOptimizationRequest): OptimizedRoute {
  const size = request.durations.length;
  const start = request.fixedStart ?? 0;
  const remaining = new Set(
    Array.from({ length: size }, (_, index) => index).filter(
      (index) => index !== start && index !== request.fixedEnd,
    ),
  );
  const order = [start];
  while (remaining.size) {
    const current = order.at(-1)!;
    const next = [...remaining].sort((a, b) => {
      const difference =
        (request.durations[current]?.[a] ?? Infinity) -
        (request.durations[current]?.[b] ?? Infinity);
      return difference || a - b;
    })[0]!;
    if (request.durations[current]?.[next] == null)
      throw new UnreachableRouteError();
    order.push(next);
    remaining.delete(next);
  }
  if (request.fixedEnd !== undefined) order.push(request.fixedEnd);

  let bestCost = routeCost(order, request.durations, request.roundTrip);
  for (let pass = 0; pass < HEURISTIC_PASSES; pass++) {
    let improved = false;
    const lastMovable = order.length - (request.fixedEnd === undefined ? 1 : 2);
    for (let left = 1; left < lastMovable; left++) {
      for (let right = left + 1; right <= lastMovable; right++) {
        const candidate = [
          ...order.slice(0, left),
          ...order.slice(left, right + 1).reverse(),
          ...order.slice(right + 1),
        ];
        const cost = routeCost(candidate, request.durations, request.roundTrip);
        if (cost < bestCost) {
          order.splice(0, order.length, ...candidate);
          bestCost = cost;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  if (!Number.isFinite(bestCost)) throw new UnreachableRouteError();
  return { order, durationSeconds: bestCost, method: 'heuristic' };
}

export const routeOptimizer: RouteOptimizer = {
  optimize(request) {
    assertRequest(request);
    return request.durations.length <= EXACT_LIMIT
      ? exact(request)
      : heuristic(request);
  },
};
