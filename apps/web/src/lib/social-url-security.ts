import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import type { SocialPlatform } from '@trip-planner/domain';

const rules: Record<SocialPlatform, { host: string; path: RegExp }> = {
  instagram: {
    host: 'www.instagram.com',
    path: /^\/(?:p|reel)\/([A-Za-z0-9_-]+)\/$/,
  },
  tiktok: { host: 'www.tiktok.com', path: /^\/@[A-Za-z0-9._]+\/video\/(\d+)$/ },
};

export class UnsafeUrlError extends Error {}

type Resolver = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

export function validateSocialUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeUrlError('Enter a valid TikTok or Instagram post URL.');
  }
  const platform = (
    Object.entries(rules) as [SocialPlatform, (typeof rules)[SocialPlatform]][]
  ).find(([, rule]) => url.hostname === rule.host)?.[0];
  const rule = platform && rules[platform];
  const match = rule?.path.exec(url.pathname);
  if (
    !platform ||
    !match ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new UnsafeUrlError(
      'Use the canonical HTTPS URL for a public TikTok video or Instagram post/reel.',
    );
  }
  return { platform, postId: match[1]!, canonicalUrl: url.href };
}

function isBlockedIp(address: string) {
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
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }
  const normalized = address.toLowerCase().split('%')[0]!;
  if (normalized.startsWith('::ffff:')) {
    return isBlockedIp(normalized.slice('::ffff:'.length));
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  );
}

export async function assertPublicHost(url: URL, resolver: Resolver = lookup) {
  if (url.protocol !== 'https:' || url.port || url.username || url.password) {
    throw new UnsafeUrlError('Outbound URLs must use standard HTTPS.');
  }
  const addresses = await resolver(url.hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isBlockedIp(address))
  ) {
    throw new UnsafeUrlError(
      'The provider URL resolved to a blocked network address.',
    );
  }
}

export async function safeFetch(
  input: string,
  options: {
    allowedHosts: ReadonlySet<string>;
    maxRedirects?: number;
    maxBytes?: number;
    fetcher?: typeof fetch;
    resolver?: Resolver;
  },
) {
  const maxRedirects = options.maxRedirects ?? 3;
  const maxBytes = options.maxBytes ?? 256_000;
  let url = new URL(input);
  for (let redirects = 0; ; redirects += 1) {
    if (!options.allowedHosts.has(url.hostname))
      throw new UnsafeUrlError(
        'Provider redirected to a host that is not allowlisted.',
      );
    await assertPublicHost(url, options.resolver);
    const response = await (options.fetcher ?? fetch)(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= maxRedirects)
        throw new UnsafeUrlError('Provider exceeded the redirect limit.');
      const location = response.headers.get('location');
      if (!location)
        throw new UnsafeUrlError('Provider returned an invalid redirect.');
      url = new URL(location, url);
      continue;
    }
    const declaredSize = Number(response.headers.get('content-length'));
    if (declaredSize > maxBytes)
      throw new UnsafeUrlError('Provider response exceeded the size limit.');
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new UnsafeUrlError('Provider response exceeded the size limit.');
      }
      chunks.push(value);
    }
    return { response, body: new TextDecoder().decode(Buffer.concat(chunks)) };
  }
}
