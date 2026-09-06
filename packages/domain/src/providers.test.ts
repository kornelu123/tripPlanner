import { describe, expect, it } from 'vitest';

import type { PriceResearchProvider, RoutingProvider } from './providers';

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

describe('PriceResearchProvider contract', () => {
  it('contains provider-neutral place context and normalized output', async () => {
    const provider: PriceResearchProvider = {
      research: async (input) => ({
        priceLevel: 'moderate',
        minimumAmount: 20,
        maximumAmount: 35,
        currency: input.currency,
        unit: 'typical_meal',
        sourceUrl: 'https://restaurant.example/menu',
        sourceType: 'official_api',
        retrievedAt: new Date('2026-09-06T00:00:00Z'),
        confidence: 0.9,
      }),
    };
    const price = await provider.research({
      placeName: 'Fixture Café',
      category: 'café',
      coordinates: { latitude: 38.7, longitude: -9.1 },
      formattedAddress: '1 Example Street',
      currency: 'EUR',
      country: 'Portugal',
    });
    expect(price).toMatchObject({ currency: 'EUR', unit: 'typical_meal' });
  });
});
