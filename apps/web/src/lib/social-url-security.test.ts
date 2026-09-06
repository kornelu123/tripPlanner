import { describe, expect, it, vi } from 'vitest';
import fixtures from './__fixtures__/social-urls.json';
import {
  assertPublicHost,
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
