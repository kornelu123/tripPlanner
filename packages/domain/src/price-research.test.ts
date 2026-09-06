import { describe, expect, it } from 'vitest';

import {
  calculateConfidence,
  isStalePrice,
  mergePriceResults,
  normalizeAmount,
  normalizeCurrency,
  PriceResearchService,
} from './price-research';
import type { PriceResearchResult } from './providers';

const result = (
  overrides: Partial<PriceResearchResult> = {},
): PriceResearchResult => ({
  priceLevel: 'moderate',
  minimumAmount: 10,
  maximumAmount: 20,
  currency: 'EUR',
  unit: 'typical_meal',
  sourceUrl: 'https://official.example/menu',
  sourceType: 'official_api',
  retrievedAt: new Date(),
  confidence: 0.8,
  ...overrides,
});

describe('price normalization and estimates', () => {
  it('normalizes currency and amounts and rejects invalid values', () => {
    expect(normalizeCurrency(' eur ')).toBe('EUR');
    expect(normalizeAmount(1.239)).toBe(1.24);
    expect(() => normalizeCurrency('$')).toThrow();
    expect(() => normalizeAmount(-1)).toThrow();
  });

  it('does not mix currencies or discard original conversion evidence', () => {
    const merged = mergePriceResults([
      result({
        originalMinimum: {
          amount: 11,
          currency: 'USD',
          exchangeRateDate: '2026-09-05',
        },
      }),
      result({
        currency: 'GBP',
        minimumAmount: 8,
        sourceUrl: 'https://other.example',
      }),
    ]);
    expect(merged?.currency).toBe('EUR');
    expect(merged?.sources).toHaveLength(1);
    expect(merged?.originalMinimum).toEqual({
      amount: 11,
      currency: 'USD',
      exchangeRateDate: '2026-09-05',
    });
  });

  it('lowers confidence for conflicts and stale evidence', () => {
    expect(calculateConfidence(2, true, true)).toBeLessThan(
      calculateConfidence(2, false, false),
    );
    expect(
      isStalePrice(
        result({ retrievedAt: new Date('2020-01-01') }),
        new Date('2026-01-01'),
      ),
    ).toBe(true);
    expect(
      mergePriceResults([
        result(),
        result({ minimumAmount: 99, sourceType: 'search_result' }),
      ])?.confidence,
    ).toBeLessThan(0.7);
  });

  it('tries providers in source priority order and stops at direct pricing', async () => {
    const calls: string[] = [];
    const service = new PriceResearchService([
      {
        research: async () => {
          calls.push('official');
          return null;
        },
      },
      {
        research: async () => {
          calls.push('search');
          return result();
        },
      },
      {
        research: async () => {
          calls.push('average');
          return result({ sourceType: 'local_average' });
        },
      },
    ]);
    await service.research({
      placeName: 'A',
      category: 'café',
      coordinates: { latitude: 1, longitude: 2 },
      formattedAddress: 'A',
      currency: 'eur',
      country: 'PT',
    });
    expect(calls).toEqual(['official', 'search']);
  });
});
