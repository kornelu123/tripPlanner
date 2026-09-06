import type { SocialMetadata, SocialPlatform } from '@trip-planner/domain';

import { safeFetch } from './social-url-security';

export class PlatformImportError extends Error {
  constructor(
    public readonly code:
      | 'private_post'
      | 'metadata_unavailable'
      | 'rate_limited',
    message: string,
  ) {
    super(message);
  }
}

export interface SocialPlatformAdapter {
  platform: SocialPlatform;
  fetchMetadata(url: string, postId: string): Promise<SocialMetadata>;
}

function failure(status: number): never {
  if (status === 401 || status === 403 || status === 404)
    throw new PlatformImportError(
      'private_post',
      'The post is private, deleted, or not shared with this application.',
    );
  if (status === 429)
    throw new PlatformImportError(
      'rate_limited',
      'The platform rate limit was reached. Try again later.',
    );
  throw new PlatformImportError(
    'metadata_unavailable',
    'The platform did not provide usable embed metadata.',
  );
}

async function oEmbed(endpoint: URL, host: string) {
  const { response, body } = await safeFetch(endpoint.href, {
    allowedHosts: new Set([host]),
  });
  if (!response.ok) failure(response.status);
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return failure(502);
  }
}

export function createPlatformAdapters(
  instagramAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN,
): Record<SocialPlatform, SocialPlatformAdapter> {
  return {
    tiktok: {
      platform: 'tiktok',
      async fetchMetadata(url, postId) {
        const endpoint = new URL('https://www.tiktok.com/oembed');
        endpoint.searchParams.set('url', url);
        const data = await oEmbed(endpoint, 'www.tiktok.com');
        return {
          platform: 'tiktok',
          canonicalUrl: url,
          postId,
          authorName: String(data.author_name ?? ''),
          title: String(data.title ?? ''),
        };
      },
    },
    instagram: {
      platform: 'instagram',
      async fetchMetadata(url, postId) {
        if (!instagramAccessToken)
          throw new PlatformImportError(
            'metadata_unavailable',
            'Instagram import is not configured.',
          );
        const endpoint = new URL(
          'https://graph.facebook.com/v23.0/instagram_oembed',
        );
        endpoint.searchParams.set('url', url);
        endpoint.searchParams.set('access_token', instagramAccessToken);
        const data = await oEmbed(endpoint, 'graph.facebook.com');
        return {
          platform: 'instagram',
          canonicalUrl: url,
          postId,
          authorName: String(data.author_name ?? ''),
          title: String(data.title ?? ''),
        };
      },
    },
  };
}
