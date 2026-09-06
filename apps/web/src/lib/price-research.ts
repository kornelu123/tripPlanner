import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import type {
  AdmissionPrice,
  PriceLevel,
  PriceResearchInput,
  PriceResearchResult,
  PriceSourceType,
  PriceUnit,
} from '@trip-planner/domain';
import {
  normalizeAmount,
  normalizeCurrency,
  PriceResearchService,
} from '@trip-planner/domain';

export class PriceFetchError extends Error {}

type Resolver = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

function blockedIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const value = address.toLowerCase().split('%')[0]!;
  return (
    value === '::' ||
    value === '::1' ||
    (value.startsWith('::ffff:') && blockedIp(value.slice(7))) ||
    /^fe[89ab]/.test(value) ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('ff')
  );
}

export async function assertSafePriceUrl(
  url: URL,
  resolver: Resolver = lookup,
) {
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new PriceFetchError('Unsupported outbound URL.');
  const addresses = await resolver(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => blockedIp(address)))
    throw new PriceFetchError('Blocked network address.');
}

export async function fetchPricePage(
  input: string,
  options: {
    accessAllowed: boolean;
    fetcher?: typeof fetch;
    resolver?: Resolver;
    maxRedirects?: number;
    maxBytes?: number;
    timeoutMs?: number;
  },
) {
  if (!options.accessAllowed)
    throw new PriceFetchError('Automated access is not permitted.');
  const maxRedirects = options.maxRedirects ?? 3;
  const maxBytes = options.maxBytes ?? 256_000;
  let url = new URL(input);
  for (let redirects = 0; ; redirects += 1) {
    await assertSafePriceUrl(url, options.resolver);
    let response: Response;
    try {
      response = await (options.fetcher ?? fetch)(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
        headers: { Accept: 'text/html, application/ld+json, application/json' },
      });
    } catch {
      throw new PriceFetchError('Price source request timed out or failed.');
    }
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= maxRedirects)
        throw new PriceFetchError('Price source exceeded the redirect limit.');
      const location = response.headers.get('location');
      if (!location) throw new PriceFetchError('Invalid redirect.');
      url = new URL(location, url);
      continue;
    }
    const contentType = response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim();
    if (
      !contentType ||
      !['text/html', 'application/ld+json', 'application/json'].includes(
        contentType,
      )
    )
      throw new PriceFetchError('Unsupported content type.');
    if (Number(response.headers.get('content-length')) > maxBytes)
      throw new PriceFetchError('Price source exceeded the size limit.');
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new PriceFetchError('Price source exceeded the size limit.');
      }
      chunks.push(chunk.value);
    }
    const combined = new Uint8Array(size);
    let offset = 0;
    chunks.forEach((chunk) => {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return {
      url: url.href,
      body: new TextDecoder().decode(combined),
      contentType,
    };
  }
}

type JsonRecord = Record<string, unknown>;

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(records);
  if (!value || typeof value !== 'object') return [];
  const record = value as JsonRecord;
  return [record, ...records(record['@graph'])];
}

function numeric(value: unknown) {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function level(
  minimum: number | undefined,
  maximum: number | undefined,
): PriceLevel {
  const amount = maximum ?? minimum ?? 0;
  if (amount < 15) return 'budget';
  if (amount < 40) return 'moderate';
  if (amount < 100) return 'expensive';
  return 'premium';
}

function result(
  minimumAmount: number | undefined,
  maximumAmount: number | undefined,
  currency: string,
  unit: PriceUnit,
  sourceUrl: string,
  sourceType: PriceSourceType,
  retrievedAt: Date,
  admissionPrices?: AdmissionPrice[],
): PriceResearchResult {
  return {
    priceLevel: level(minimumAmount, maximumAmount),
    minimumAmount,
    maximumAmount,
    currency: normalizeCurrency(currency),
    unit,
    sourceUrl,
    sourceType,
    retrievedAt,
    confidence: 0.6,
    admissionPrices,
  };
}

export function parseStructuredPrice(
  document: string,
  options: { category: string; sourceUrl: string; retrievedAt?: Date },
) {
  const snippets = [
    ...document.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => match[1]!);
  if (!snippets.length && document.trim().startsWith('{'))
    snippets.push(document);
  const parsed = snippets.flatMap((snippet) => {
    try {
      return records(JSON.parse(snippet));
    } catch {
      return [];
    }
  });
  const retrievedAt = options.retrievedAt ?? new Date();
  const restaurant = /restaurant|café|cafe|food/i.test(options.category);
  if (restaurant) {
    const menuPrices = parsed
      .flatMap((item) => {
        const offers = records(item.offers);
        return offers
          .map((offer) => numeric(offer.price))
          .filter((price): price is number => price !== undefined);
      })
      .sort((a, b) => a - b);
    if (menuPrices.length >= 2) {
      // Middle quartiles are a better typical meal than menu extremes.
      const minimum = menuPrices[Math.floor((menuPrices.length - 1) * 0.25)]!;
      const maximum = menuPrices[Math.ceil((menuPrices.length - 1) * 0.75)]!;
      const currency = parsed
        .flatMap((item) => records(item.offers))
        .map((offer) => offer.priceCurrency)
        .find((value): value is string => typeof value === 'string');
      if (currency)
        return result(
          minimum,
          maximum,
          currency,
          'typical_meal',
          options.sourceUrl,
          'official_structured_data',
          retrievedAt,
        );
    }
  }
  for (const item of parsed) {
    const range =
      typeof item.priceRange === 'string'
        ? [...item.priceRange.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
            Number(match[0]!.replace(',', '.')),
          )
        : [];
    if (range.length) {
      const currency =
        typeof item.currenciesAccepted === 'string'
          ? item.currenciesAccepted
          : 'USD';
      return result(
        range[0],
        range.at(-1),
        currency,
        restaurant ? 'typical_meal' : 'admission',
        options.sourceUrl,
        'official_structured_data',
        retrievedAt,
      );
    }
    const offers = records(item.offers);
    if (offers.length) {
      const admissions = offers.flatMap((offer) => {
        const amount = numeric(offer.price);
        const currency = offer.priceCurrency;
        if (amount === undefined || typeof currency !== 'string') return [];
        const name = String(offer.name ?? 'general').toLowerCase();
        const audience = (['child', 'student', 'senior', 'adult'].find((kind) =>
          name.includes(kind),
        ) ?? 'general') as AdmissionPrice['audience'];
        return [
          {
            audience,
            amount: normalizeAmount(amount),
            currency: normalizeCurrency(currency),
          },
        ];
      });
      if (admissions.length) {
        const currency = admissions[0]!.currency;
        const sameCurrency = admissions.filter(
          (price) => price.currency === currency,
        );
        return result(
          Math.min(...sameCurrency.map(({ amount }) => amount)),
          Math.max(...sameCurrency.map(({ amount }) => amount)),
          currency,
          'admission',
          options.sourceUrl,
          'official_structured_data',
          retrievedAt,
          sameCurrency,
        );
      }
    }
  }
  return null;
}

export interface PriceCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export class PriceLookupCoordinator {
  constructor(
    private readonly service: PriceResearchService,
    private readonly cache: PriceCache,
  ) {}

  async research(input: PriceResearchInput) {
    const key = `price:v1:${JSON.stringify(input)}`;
    const cached = await this.cache.get(key);
    if (cached) {
      const value = JSON.parse(cached) as PriceResearchResult;
      value.retrievedAt = new Date(value.retrievedAt);
      return value;
    }
    const value = await this.service.research(input);
    if (value) await this.cache.set(key, JSON.stringify(value), { EX: 3_600 });
    return value;
  }

  async assertRefreshAllowed(userId: string, placeId: string) {
    const key = `price-refresh:${userId}:${placeId}`;
    const count = await this.cache.incr(key);
    if (count === 1) await this.cache.expire(key, 60);
    if (count > 3) throw new Error('RATE_LIMITED');
  }
}
