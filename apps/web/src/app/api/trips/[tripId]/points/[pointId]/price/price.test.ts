import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeTrip: vi.fn(),
  getRedisClient: vi.fn(),
  enqueue: vi.fn(() => true),
  findPoint: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authorizeTrip: mocks.authorizeTrip,
}));
vi.mock('@trip-planner/database', () => ({
  getRedisClient: mocks.getRedisClient,
}));
vi.mock('@/lib/price-research-worker', () => ({
  enqueuePriceResearch: mocks.enqueue,
}));
vi.mock('@/lib/trip-editor-store', () => ({
  findTripPoint: mocks.findPoint,
}));
vi.mock('@/lib/price-research', () => ({
  PriceLookupCoordinator: class {
    constructor(
      _service: unknown,
      private readonly cache: {
        incr(key: string): Promise<number>;
        expire(key: string, seconds: number): Promise<unknown>;
      },
    ) {}
    async assertRefreshAllowed(userId: string, pointId: string) {
      const key = `${userId}:${pointId}`;
      const count = await this.cache.incr(key);
      if (count === 1) await this.cache.expire(key, 60);
      if (count > 3) throw new Error('RATE_LIMITED');
    }
  },
}));

import { POST } from './route';

const context = (tripId: string, pointId: string) => ({
  params: Promise.resolve({ tripId, pointId }),
});

describe('price refresh API', () => {
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(async () => 1),
    expire: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeTrip.mockResolvedValue({
      error: null,
      user: { id: 'owner' },
    });
    mocks.getRedisClient.mockResolvedValue(cache);
    cache.incr.mockResolvedValue(1);
    mocks.findPoint.mockReturnValue({ id: 'point' });
  });

  it('requires authentication and trip ownership before queueing', async () => {
    const error = Response.json(
      { message: 'Authentication required.' },
      { status: 401 },
    );
    mocks.authorizeTrip.mockResolvedValueOnce({ error });
    const response = await POST(
      new Request('http://localhost'),
      context('trip', 'point'),
    );
    expect(response.status).toBe(401);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('returns 404 for a point outside the authorized trip', async () => {
    mocks.findPoint.mockReturnValueOnce(undefined);
    const response = await POST(
      new Request('http://localhost'),
      context(crypto.randomUUID(), 'missing'),
    );
    expect(response.status).toBe(404);
  });

  it('queues valid work without waiting for a provider', async () => {
    const tripId = crypto.randomUUID();
    const pointId = 'point';
    const response = await POST(
      new Request('http://localhost'),
      context(tripId, pointId),
    );
    expect(response.status).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalledWith(tripId, pointId);
  });

  it('rate limits refreshes and omits internal provider details', async () => {
    const tripId = crypto.randomUUID();
    const pointId = 'point';
    cache.incr.mockResolvedValueOnce(4);
    const limited = await POST(
      new Request('http://localhost'),
      context(tripId, pointId),
    );
    expect(limited.status).toBe(429);

    mocks.getRedisClient.mockRejectedValueOnce(
      new Error('redis://secret:password@host'),
    );
    const failed = await POST(
      new Request('http://localhost'),
      context(tripId, pointId),
    );
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('password');
  });
});
