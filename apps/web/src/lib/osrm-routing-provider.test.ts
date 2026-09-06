import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { OsrmRoutingProvider } from './osrm-routing-provider';

async function fixture(name: string) {
  return readFile(new URL(`__fixtures__/${name}`, import.meta.url), 'utf8');
}

describe('OSRM routing provider contract', () => {
  it('maps a recorded duration matrix without hiding unreachable cells', async () => {
    const body = await fixture('osrm-table.json');
    const request = vi.fn(async () => new Response(body));
    const provider = new OsrmRoutingProvider('https://routing.test', request);
    const result = await provider.durationMatrix(
      [
        { latitude: 38.707, longitude: -9.1457 },
        { latitude: 38.7191, longitude: -9.1328 },
      ],
      'walking',
    );
    expect(result.durations).toEqual([
      [0, 120.4],
      [118.6, 0],
    ]);
    expect(result.metadata).toMatchObject({
      provider: 'osrm',
      profile: 'walking',
    });
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/table/v1/walking/'),
    );
  });

  it('maps recorded detailed geometry in longitude/latitude order', async () => {
    const body = await fixture('osrm-route.json');
    const provider = new OsrmRoutingProvider(
      'https://routing.test',
      vi.fn(async () => new Response(body)),
    );
    const result = await provider.calculateRoute({
      origin: { latitude: 38.707, longitude: -9.1457 },
      destination: { latitude: 38.7191, longitude: -9.1328 },
      mode: 'driving',
    });
    expect(result).toMatchObject({ distanceMeters: 853, durationSeconds: 121 });
    expect(result.path[1]).toEqual({ latitude: 38.713, longitude: -9.14 });
  });

  it('reports missing routes instead of inventing straight geometry', async () => {
    const provider = new OsrmRoutingProvider(
      'https://routing.test',
      vi.fn(async () => Response.json({ code: 'NoRoute', routes: [] })),
    );
    await expect(
      provider.calculateRoute({
        origin: { latitude: 0, longitude: 0 },
        destination: { latitude: 1, longitude: 1 },
        mode: 'walking',
      }),
    ).rejects.toMatchObject({ kind: 'unreachable' });
  });
});
