import { describe, expect, it } from 'vitest';
import type { SocialImport } from '@trip-planner/domain';
import { getSocialImport, saveSocialImport } from './social-import-store';
import { processSocialImport } from './social-import-worker';
import { PlatformImportError } from './social-platform-adapters';

function queued(): SocialImport {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    tripId: crypto.randomUUID(),
    sourceUrl: 'https://www.tiktok.com/@user/video/123',
    platform: 'tiktok',
    status: 'queued',
    candidates: [],
    createdAt: now,
    updatedAt: now,
  };
}
describe('social import worker', () => {
  it('retains an actionable private-post failure', async () => {
    const item = saveSocialImport(queued());
    await processSocialImport(item.tripId, item.id, {
      adapters: {
        tiktok: {
          platform: 'tiktok',
          fetchMetadata: async () => {
            throw new PlatformImportError(
              'private_post',
              'The post is private.',
            );
          },
        },
      },
    });
    expect(getSocialImport(item.tripId, item.id)).toMatchObject({
      status: 'failed',
      failure: { code: 'private_post', message: 'The post is private.' },
    });
  });
  it('reports no detected location separately', async () => {
    const item = saveSocialImport(queued());
    await processSocialImport(item.tripId, item.id, {
      adapters: {
        tiktok: {
          platform: 'tiktok',
          fetchMetadata: async () => ({
            platform: 'tiktok',
            canonicalUrl: item.sourceUrl,
            postId: '123',
            title: 'A nice day',
          }),
        },
      },
      geocoder: { search: async () => [], reverse: async () => null },
    });
    expect(getSocialImport(item.tripId, item.id)?.failure?.code).toBe(
      'no_location_detected',
    );
  });
});
