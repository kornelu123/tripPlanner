import { describe, expect, it } from 'vitest';

import { routeOptimizer } from './route-optimizer';
import { UnreachableRouteError } from './providers';

describe('routeOptimizer', () => {
  it('finds an exact route while respecting fixed endpoints', () => {
    const result = routeOptimizer.optimize({
      durations: [
        [0, 2, 9, 8],
        [2, 0, 3, 9],
        [9, 3, 0, 1],
        [8, 9, 1, 0],
      ],
      fixedStart: 0,
      fixedEnd: 3,
      roundTrip: false,
    });
    expect(result).toEqual({
      order: [0, 1, 2, 3],
      durationSeconds: 6,
      method: 'exact',
    });
  });

  it('uses a deterministic bounded heuristic for larger matrices', () => {
    const durations = Array.from({ length: 11 }, (_, from) =>
      Array.from({ length: 11 }, (_, to) =>
        from === to ? 0 : Math.abs(from - to),
      ),
    );
    expect(
      routeOptimizer.optimize({ durations, fixedStart: 0, roundTrip: false }),
    ).toEqual({
      order: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      durationSeconds: 10,
      method: 'heuristic',
    });
  });

  it('rejects unreachable selections', () => {
    expect(() =>
      routeOptimizer.optimize({
        durations: [
          [0, null],
          [null, 0],
        ],
        fixedStart: 0,
        roundTrip: false,
      }),
    ).toThrow(UnreachableRouteError);
  });
});
