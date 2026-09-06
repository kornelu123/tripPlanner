import type { Coordinates, GeocodingProvider, Place } from './providers';

export type SocialPlatform = 'instagram' | 'tiktok';
export type SocialImportStatus =
  | 'queued'
  | 'processing'
  | 'needs_confirmation'
  | 'completed'
  | 'failed';

export type SocialImportFailureCode =
  | 'private_post'
  | 'unsupported_link'
  | 'metadata_unavailable'
  | 'rate_limited'
  | 'no_location_detected';

export interface SocialMetadata {
  platform: SocialPlatform;
  canonicalUrl: string;
  postId: string;
  authorName?: string;
  title?: string;
  caption?: string;
  placeName?: string;
}

export interface LocationEvidence {
  text: string;
  source: 'platform_place' | 'caption' | 'title';
}

export interface LocationCandidate {
  id: string;
  name: string;
  address: string;
  position: Coordinates;
  confidence: number;
  evidence: LocationEvidence[];
}

export interface SocialImport {
  id: string;
  tripId: string;
  sourceUrl: string;
  platform: SocialPlatform;
  status: SocialImportStatus;
  candidates: LocationCandidate[];
  failure?: { code: SocialImportFailureCode; message: string };
  createdAt: string;
  updatedAt: string;
}

const transitions: Record<SocialImportStatus, SocialImportStatus[]> = {
  queued: ['processing', 'failed'],
  processing: ['needs_confirmation', 'failed'],
  needs_confirmation: ['completed', 'failed'],
  completed: [],
  failed: [],
};

export function transitionSocialImport(
  socialImport: SocialImport,
  status: SocialImportStatus,
): SocialImport {
  if (!transitions[socialImport.status].includes(status)) {
    throw new Error(
      `Invalid social import transition: ${socialImport.status} -> ${status}`,
    );
  }
  return { ...socialImport, status, updatedAt: new Date().toISOString() };
}

function evidenceFrom(metadata: SocialMetadata): LocationEvidence[] {
  const evidence: LocationEvidence[] = [];
  if (metadata.placeName?.trim()) {
    evidence.push({
      text: metadata.placeName.trim(),
      source: 'platform_place',
    });
  }
  for (const [text, source] of [
    [metadata.caption, 'caption'],
    [metadata.title, 'title'],
  ] as const) {
    if (!text) continue;
    const matches = text.matchAll(
      /(?:at|in|near|visit(?:ing)?|📍)\s+([\p{L}\p{N}][\p{L}\p{N}'’.& -]{2,60})/giu,
    );
    for (const match of matches) {
      const candidate = match[1]?.split(/[|#\n.!?]/)[0]?.trim();
      if (candidate) evidence.push({ text: candidate, source });
    }
  }
  return evidence.filter(
    ({ text }, index, all) =>
      all.findIndex(
        (item) => item.text.toLowerCase() === text.toLowerCase(),
      ) === index,
  );
}

function distanceSquared(a: Coordinates, b?: Coordinates) {
  if (!b) return 0;
  return (a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2;
}

export async function extractLocationCandidates(
  metadata: SocialMetadata,
  geocoder: GeocodingProvider,
  tripContext?: Coordinates,
): Promise<LocationCandidate[]> {
  const evidence = evidenceFrom(metadata);
  const matches = await Promise.all(
    evidence.map(async (item) => ({
      item,
      places: await geocoder.search(item.text, tripContext),
    })),
  );
  const candidates = new Map<string, LocationCandidate>();
  for (const { item, places } of matches) {
    places.forEach((place: Place) => {
      const key = `${place.coordinates.latitude},${place.coordinates.longitude}`;
      const existing = candidates.get(key);
      const sourceWeight = item.source === 'platform_place' ? 0.75 : 0.55;
      const confidence = sourceWeight;
      if (existing) {
        existing.evidence.push(item);
        existing.confidence = Math.min(0.99, existing.confidence + 0.15);
      } else {
        candidates.set(key, {
          id: place.id,
          name: place.name,
          address: place.formattedAddress ?? place.name,
          position: place.coordinates,
          confidence,
          evidence: [item],
        });
      }
    });
  }
  return [...candidates.values()].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      distanceSquared(a.position, tripContext) -
        distanceSquared(b.position, tripContext),
  );
}
