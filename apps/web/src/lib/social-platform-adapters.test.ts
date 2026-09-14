import { describe, expect, it, vi } from 'vitest';

import { createPlatformAdapters } from './social-platform-adapters';

vi.mock('./social-url-security', () => ({
  safeFetch: vi.fn(async () => ({
    response: new Response(null, { status: 200 }),
    body: JSON.stringify({
      title: 'Dinner in Lisbon',
      author_name: 'Traveler',
      author_url: 'https://www.tiktok.com/@traveler',
      thumbnail_url: 'https://cdn.example.test/preview.jpg',
      type: 'video',
    }),
  })),
}));

describe('social platform adapters', () => {
  it('maps available oEmbed post context into provider-neutral metadata', async () => {
    await expect(
      createPlatformAdapters().tiktok.fetchMetadata(
        'https://www.tiktok.com/@traveler/video/123',
        '123',
      ),
    ).resolves.toMatchObject({
      caption: 'Dinner in Lisbon',
      authorName: 'Traveler',
      authorUrl: 'https://www.tiktok.com/@traveler',
      thumbnailUrl: 'https://cdn.example.test/preview.jpg',
      mediaType: 'video',
    });
  });
});
