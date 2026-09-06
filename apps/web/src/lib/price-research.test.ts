import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { PriceResearchService } from '@trip-planner/domain';

import {
  assertSafePriceUrl,
  fetchPricePage,
  parseStructuredPrice,
  PriceLookupCoordinator,
  type PriceCache,
} from './price-research';

const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }];

describe('safe price page fetching', () => {
  it('does not fetch when automated access is prohibited', async () => {
    const fetcher = vi.fn();
    await expect(
      fetchPricePage('https://source.example', {
        accessAllowed: false,
        fetcher,
      }),
    ).rejects.toThrow(/not permitted/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fd00::1'])(
    'rejects private, loopback, link-local, or metadata address %s',
    async (address) => {
      await expect(
        assertSafePriceUrl(new URL('https://source.example'), async () => [
          { address, family: address.includes(':') ? 6 : 4 },
        ]),
      ).rejects.toThrow(/Blocked/);
    },
  );
  it('allows only HTTP(S) and rejects a redirected private host', async () => {
    await expect(
      assertSafePriceUrl(new URL('file:///etc/passwd')),
    ).rejects.toThrow(/Unsupported/);
    const resolver = vi.fn(async (hostname: string) => [
      {
        address: hostname === 'private.example' ? '127.0.0.1' : '93.184.216.34',
        family: 4,
      },
    ]);
    await expect(
      fetchPricePage('https://public.example', {
        accessAllowed: true,
        resolver,
        fetcher: async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://private.example/menu' },
          }),
      }),
    ).rejects.toThrow(/Blocked/);
  });
  it('rejects redirect loops, oversized bodies, and unsupported types', async () => {
    await expect(
      fetchPricePage('https://source.example', {
        accessAllowed: true,
        resolver: publicResolver,
        maxRedirects: 0,
        fetcher: async () =>
          new Response(null, { status: 302, headers: { location: '/again' } }),
      }),
    ).rejects.toThrow(/redirect limit/);
    await expect(
      fetchPricePage('https://source.example', {
        accessAllowed: true,
        resolver: publicResolver,
        maxBytes: 3,
        fetcher: async () =>
          new Response('four', { headers: { 'content-type': 'text/html' } }),
      }),
    ).rejects.toThrow(/size limit/);
    await expect(
      fetchPricePage('https://source.example', {
        accessAllowed: true,
        resolver: publicResolver,
        fetcher: async () =>
          new Response('pdf', {
            headers: { 'content-type': 'application/pdf' },
          }),
      }),
    ).rejects.toThrow(/content type/);
  });
  it('turns request timeout/failure into a safe error', async () => {
    await expect(
      fetchPricePage('https://source.example', {
        accessAllowed: true,
        resolver: publicResolver,
        fetcher: async () => {
          throw new Error('secret');
        },
      }),
    ).rejects.toThrow('timed out or failed');
  });
});

describe('structured price contract fixtures', () => {
  it('uses middle menu quartiles for restaurant and café typical meals', async () => {
    const html = await readFile(
      new URL('./__fixtures__/restaurant-price.html', import.meta.url),
      'utf8',
    );
    const price = parseStructuredPrice(html, {
      category: 'café',
      sourceUrl: 'https://cafe.example/menu',
    });
    expect(price).toMatchObject({
      minimumAmount: 8,
      maximumAmount: 24,
      currency: 'EUR',
      unit: 'typical_meal',
    });
  });
  it('keeps museum admission groups, including free child entry, separate', async () => {
    const json = await readFile(
      new URL('./__fixtures__/museum-price.json', import.meta.url),
      'utf8',
    );
    const price = parseStructuredPrice(json, {
      category: 'museum',
      sourceUrl: 'https://museum.example/tickets',
    });
    expect(price?.unit).toBe('admission');
    expect(price?.admissionPrices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ audience: 'adult', amount: 18 }),
        expect.objectContaining({ audience: 'child', amount: 0 }),
        expect.objectContaining({ audience: 'student', amount: 9 }),
        expect.objectContaining({ audience: 'senior', amount: 12 }),
      ]),
    );
  });
  it.each([
    '',
    '<script type="application/ld+json">{bad}</script>',
    '{"name":"No price"}',
  ])('returns unavailable for missing or malformed metadata', (document) =>
    expect(
      parseStructuredPrice(document, {
        category: 'museum',
        sourceUrl: 'https://example.test',
      }),
    ).toBeNull(),
  );
});

describe('cache and refresh limits', () => {
  function fakeCache(): PriceCache {
    const values = new Map<string, string>();
    return {
      get: async (key) => values.get(key) ?? null,
      set: async (key, value) => void values.set(key, value),
      incr: async (key) => {
        const next = Number(values.get(key) ?? 0) + 1;
        values.set(key, String(next));
        return next;
      },
      expire: async () => true,
    };
  }
  it('caches short-lived lookups and limits explicit refreshes', async () => {
    const research = vi.fn(async () => ({
      priceLevel: 'budget' as const,
      minimumAmount: 3,
      maximumAmount: 6,
      currency: 'EUR',
      unit: 'per_person' as const,
      sourceUrl: 'https://official.example',
      sourceType: 'official_api' as const,
      retrievedAt: new Date(),
      confidence: 0.6,
    }));
    const coordinator = new PriceLookupCoordinator(
      new PriceResearchService([{ research }]),
      fakeCache(),
    );
    const input = {
      placeName: 'Cafe',
      category: 'café',
      coordinates: { latitude: 1, longitude: 2 },
      formattedAddress: 'Street',
      currency: 'EUR',
      country: 'PT',
    };
    await coordinator.research(input);
    await coordinator.research(input);
    expect(research).toHaveBeenCalledOnce();
    await coordinator.assertRefreshAllowed('user', 'place');
    await coordinator.assertRefreshAllowed('user', 'place');
    await coordinator.assertRefreshAllowed('user', 'place');
    await expect(
      coordinator.assertRefreshAllowed('user', 'place'),
    ).rejects.toThrow('RATE_LIMITED');
  });
});
