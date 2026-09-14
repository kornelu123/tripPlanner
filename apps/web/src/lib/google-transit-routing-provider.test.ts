import { describe, expect, it, vi } from 'vitest';

import { GoogleTransitRoutingProvider } from './google-transit-routing-provider';

const response = {
  routes: [
    {
      distanceMeters: 7_400,
      duration: '1500s',
      polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
      legs: [
        {
          steps: [
            {
              distanceMeters: 300,
              staticDuration: '240s',
              travelMode: 'WALK',
              navigationInstruction: {
                instructions: 'Walk to Central Station',
              },
            },
            {
              distanceMeters: 7_100,
              staticDuration: '1260s',
              travelMode: 'TRANSIT',
              transitDetails: {
                stopDetails: {
                  departureStop: {
                    name: 'Central Station',
                    location: {
                      latLng: { latitude: 38.71, longitude: -9.14 },
                    },
                  },
                  departureTime: '2099-06-01T09:10:00Z',
                  arrivalStop: {
                    name: 'Riverside',
                    location: {
                      latLng: { latitude: 38.75, longitude: -9.1 },
                    },
                  },
                  arrivalTime: '2099-06-01T09:31:00Z',
                },
                headsign: 'Riverside',
                stopCount: 6,
                transitLine: {
                  agencies: [{ name: 'Local Rail' }],
                  name: 'Riverside Line',
                  nameShort: 'L2',
                  vehicle: {
                    name: { text: 'Commuter train' },
                    type: 'COMMUTER_TRAIN',
                  },
                },
              },
            },
          ],
        },
      ],
    },
  ],
};

describe('Google transit routing provider', () => {
  it('maps scheduled local-train and walking details without exposing the key', async () => {
    const request = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void input;
        void init;
        return Response.json(response);
      },
    );
    const provider = new GoogleTransitRoutingProvider(
      'server-secret',
      request,
      'https://routes.test/compute',
    );
    const route = await provider.calculateRoute({
      origin: { latitude: 38.7, longitude: -9.15 },
      destination: { latitude: 38.76, longitude: -9.09 },
      mode: 'transit',
      departureTime: '2099-06-01T09:00:00Z',
    });

    expect(route).toMatchObject({
      distanceMeters: 7_400,
      durationSeconds: 1_500,
      departureTime: '2099-06-01T09:10:00Z',
      arrivalTime: '2099-06-01T09:31:00Z',
      metadata: { provider: 'google-routes', profile: 'transit' },
    });
    expect(route.steps).toEqual([
      expect.objectContaining({
        mode: 'walking',
        instructions: 'Walk to Central Station',
      }),
      expect.objectContaining({
        mode: 'transit',
        transit: expect.objectContaining({
          lineShortName: 'L2',
          headsign: 'Riverside',
          vehicleType: 'COMMUTER_TRAIN',
          stopCount: 6,
        }),
      }),
    ]);
    expect(route.path).toHaveLength(3);
    expect(request).toHaveBeenCalledWith(
      'https://routes.test/compute',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Goog-Api-Key': 'server-secret' }),
      }),
    );
    expect(request.mock.calls[0]?.[0]).not.toContain('server-secret');
  });

  it('reports an absent scheduled route as unreachable', async () => {
    const provider = new GoogleTransitRoutingProvider(
      'server-secret',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        void input;
        void init;
        return Response.json({ routes: [] });
      }),
    );
    await expect(
      provider.calculateRoute({
        origin: { latitude: 0, longitude: 0 },
        destination: { latitude: 1, longitude: 1 },
        mode: 'transit',
        departureTime: '2099-06-01T09:00:00Z',
      }),
    ).rejects.toMatchObject({ kind: 'unreachable' });
  });
});
