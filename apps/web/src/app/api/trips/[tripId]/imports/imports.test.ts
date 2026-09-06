import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../lib/auth', () => ({
  authorizeTrip: () => ({ error: null }),
}));

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock('../../../../../lib/social-import-worker', () => ({
  enqueueSocialImport: enqueue,
}));

import { POST } from './route';

const context = { params: Promise.resolve({ tripId: 'trip-1' }) };

describe('trip imports API', () => {
  beforeEach(() => enqueue.mockClear());

  it('enqueues a canonical social URL without fetching it in the handler', async () => {
    const response = await POST(
      new Request('http://localhost/api/trips/trip-1/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.instagram.com/reel/AbC123/',
        }),
      }),
      context,
    );
    expect(response.status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'instagram',
        status: 'queued',
      }),
    );
  });

  it('returns an actionable unsupported-link response', async () => {
    const response = await POST(
      new Request('http://localhost/api/trips/trip-1/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://instagram.com/p/not-canonical/' }),
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'unsupported_link' });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
