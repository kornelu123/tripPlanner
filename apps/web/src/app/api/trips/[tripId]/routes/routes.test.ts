import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTripEditorData } from '../../../../../lib/trip-editor-store';

import { POST } from './route';

function request(tripId: string) {
  const pointIds = getTripEditorData(tripId).points.map(({ id }) => id);
  return new Request(`http://localhost/api/trips/${tripId}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pointIds, mode: 'walking', roundTrip: false }),
  });
}

const context = (tripId: string) => ({ params: Promise.resolve({ tripId }) });

describe('trip routes API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('optimizes first, fetches each detailed leg, and saves only the complete plan', async () => {
    const providerResponses = [
      {
        code: 'Ok',
        durations: [
          [0, 10, 50],
          [10, 0, 20],
          [50, 20, 0],
        ],
      },
      {
        code: 'Ok',
        routes: [
          {
            distance: 100,
            duration: 10,
            geometry: {
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
          },
        ],
      },
      {
        code: 'Ok',
        routes: [
          {
            distance: 200,
            duration: 20,
            geometry: {
              coordinates: [
                [1, 1],
                [2, 2],
              ],
            },
          },
        ],
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(providerResponses.shift())),
    );
    const tripId = crypto.randomUUID();
    const response = await POST(request(tripId), context(tripId));
    const plan = await response.json();
    expect(response.status).toBe(201);
    expect(plan).toMatchObject({
      totalDistanceMeters: 300,
      totalDurationSeconds: 30,
      optimizationMethod: 'exact',
    });
    expect(plan.legs).toHaveLength(2);
    expect(getTripEditorData(tripId).routePlan?.id).toBe(plan.id);
  });

  it('reports a partial provider failure without replacing the saved plan', async () => {
    const tripId = crypto.randomUUID();
    const existing = { ...getTripEditorData(tripId), routePlan: undefined };
    const providerResponses = [
      Response.json({
        code: 'Ok',
        durations: [
          [0, 10, 50],
          [10, 0, 20],
          [50, 20, 0],
        ],
      }),
      Response.json({
        code: 'Ok',
        routes: [
          {
            distance: 100,
            duration: 10,
            geometry: {
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
          },
        ],
      }),
      new Response(null, { status: 503 }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => providerResponses.shift()!),
    );
    const response = await POST(request(tripId), context(tripId));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'PROVIDER_FAILURE' });
    expect(existing.routePlan).toBeUndefined();
    expect(getTripEditorData(tripId).routePlan).toBeUndefined();
  });

  it('identifies unreachable stops from null matrix cells', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          code: 'Ok',
          durations: [
            [0, null, null],
            [null, 0, null],
            [null, null, 0],
          ],
        }),
      ),
    );
    const tripId = crypto.randomUUID();
    const response = await POST(request(tripId), context(tripId));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'UNREACHABLE_STOPS' });
  });

  it('rejects matching fixed endpoints before calling the provider', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const tripId = crypto.randomUUID();
    const pointIds = getTripEditorData(tripId).points.map(({ id }) => id);
    const invalidRequest = new Request(
      `http://localhost/api/trips/${tripId}/routes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointIds,
          mode: 'walking',
          roundTrip: false,
          fixedStartId: pointIds[0],
          fixedEndId: pointIds[0],
        }),
      },
    );
    const response = await POST(invalidRequest, context(tripId));
    expect(response.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
});
