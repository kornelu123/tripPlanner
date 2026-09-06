import { describe, expect, it } from 'vitest';

import type { RoutingProvider } from './providers';

describe('RoutingProvider contract', () => {
  it('allows routing implementations without exposing provider types', async () => {
    const provider: RoutingProvider = {
      durationMatrix: async () => ({
        durations: [
          [0, 600],
          [600, 0],
        ],
        metadata: { provider: 'fixture', profile: 'walking' },
      }),
      calculateRoute: async ({ origin, destination }) => ({
        distanceMeters: 1_000,
        durationSeconds: 600,
        path: [origin, destination],
        metadata: { provider: 'fixture', profile: 'walking' },
      }),
    };

    const route = await provider.calculateRoute({
      origin: { latitude: 51.5, longitude: -0.1 },
      destination: { latitude: 51.51, longitude: -0.11 },
      mode: 'walking',
    });

    expect(route.path).toHaveLength(2);
  });
});
