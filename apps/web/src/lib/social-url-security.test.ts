import { describe, expect, it, vi } from 'vitest';
import fixtures from './__fixtures__/social-urls.json';
import {
  assertPublicHost,
  resolveSocialUrl,
  safeFetch,
  validateSocialUrl,
} from './social-url-security';

describe('social URL security', () => {
  it('accepts only fixture-listed canonical URLs', () => {
    fixtures.valid.forEach((url) =>
      expect(() => validateSocialUrl(url)).not.toThrow(),
    );
    fixtures.invalid.forEach((url) =>
      expect(() => validateSocialUrl(url)).toThrow(),
    );
  });
  it('normalizes safe Instagram and TikTok URL variants', () => {
    expect(
      validateSocialUrl('https://instagram.com/reel/AbC123?utm_source=share'),
    ).toEqual({
      platform: 'instagram',
      postId: 'AbC123',
      canonicalUrl: 'https://www.instagram.com/reel/AbC123/',
    });
    expect(
      validateSocialUrl(
        'https://m.tiktok.com/v/7412345678901234567.html?is_from_webapp=1',
      ),
    ).toEqual({
      platform: 'tiktok',
      postId: '7412345678901234567',
      canonicalUrl: 'https://www.tiktok.com/@_/video/7412345678901234567',
    });
  });
  it('resolves allowlisted TikTok short links before validation', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: {
          location: 'https://www.tiktok.com/@traveler/video/123',
        },
      }),
    );
    await expect(
      resolveSocialUrl('https://vm.tiktok.com/ZMshort/', {
        fetcher,
        resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      }),
    ).resolves.toMatchObject({ platform: 'tiktok', postId: '123' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fd00::1'])(
    'blocks private or link-local address %s',
    async (address) => {
      await expect(
        assertPublicHost(new URL('https://provider.test'), async () => [
          { address, family: address.includes(':') ? 6 : 4 },
        ]),
      ).rejects.toThrow(/blocked/);
    },
  );
  it('revalidates redirects and enforces the limit', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: '/again' } }),
    );
    await expect(
      safeFetch('https://provider.test/start', {
        allowedHosts: new Set(['provider.test']),
        maxRedirects: 1,
        fetcher,
        resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      }),
    ).rejects.toThrow(/redirect limit/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('blocks oversized streamed responses', async () => {
    await expect(
      safeFetch('https://provider.test/data', {
        allowedHosts: new Set(['provider.test']),
        maxBytes: 3,
        fetcher: async () => new Response('four'),
        resolver: async () => [{ address: '93.184.216.34', family: 4 }],
      }),
    ).rejects.toThrow(/size limit/);
  });
});
