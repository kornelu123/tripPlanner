import type {
  PriceResearchInput,
  PriceResearchProvider,
  PriceResearchResult,
  PriceSource,
} from './providers';

const sourceOrder = [
  'official_api',
  'ticketing_api',
  'search_result',
  'official_structured_data',
  'public_page',
  'local_average',
] as const;

export function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error('Invalid currency.');
  return normalized;
}

export function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error('Invalid price amount.');
  return Math.round(amount * 100) / 100;
}

export function isStalePrice(result: PriceResearchResult, now = new Date()) {
  return now.getTime() - result.retrievedAt.getTime() > 24 * 60 * 60 * 1_000;
}

export function calculateConfidence(
  directSourceCount: number,
  conflicting: boolean,
  stale: boolean,
): number {
  const score = 0.45 + Math.min(directSourceCount, 3) * 0.15;
  return Math.max(
    0,
    Math.min(1, score - (conflicting ? 0.25 : 0) - (stale ? 0.2 : 0)),
  );
}

export function mergePriceResults(results: PriceResearchResult[]) {
  if (!results.length) return null;
  const currency = normalizeCurrency(results[0]!.currency);
  // Conversion is deliberately not implicit: differently denominated evidence is excluded.
  const sameCurrency = results.filter(
    (result) => normalizeCurrency(result.currency) === currency,
  );
  const preferred = [...sameCurrency].sort(
    (a, b) =>
      sourceOrder.indexOf(a.sourceType) - sourceOrder.indexOf(b.sourceType),
  )[0]!;
  const conflicting = sameCurrency.some(
    (result) =>
      result !== preferred &&
      (result.minimumAmount !== preferred.minimumAmount ||
        result.maximumAmount !== preferred.maximumAmount),
  );
  const sources: PriceSource[] = sameCurrency.flatMap((result) =>
    result.sources?.length
      ? result.sources
      : [
          {
            url: result.sourceUrl,
            type: result.sourceType,
            retrievedAt: result.retrievedAt,
          },
        ],
  );
  return {
    ...preferred,
    currency,
    sources: [
      ...new Map(sources.map((source) => [source.url, source])).values(),
    ],
    confidence: calculateConfidence(
      sameCurrency.filter((result) => result.sourceType !== 'local_average')
        .length,
      conflicting,
      isStalePrice(preferred),
    ),
  } satisfies PriceResearchResult;
}

export class PriceResearchService {
  constructor(private readonly providers: PriceResearchProvider[]) {}

  async research(input: PriceResearchInput) {
    for (const provider of this.providers) {
      const result = await provider.research({
        ...input,
        currency: normalizeCurrency(input.currency),
      });
      if (result) return mergePriceResults([result]);
    }
    return null;
  }
}
