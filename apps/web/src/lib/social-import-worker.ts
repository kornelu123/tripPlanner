import type { GeocodingProvider, SocialImport } from '@trip-planner/domain';
import {
  extractLocationCandidates,
  transitionSocialImport,
} from '@trip-planner/domain';

import { getTripEditorData } from './trip-editor-store';
import {
  createPlatformAdapters,
  PlatformImportError,
  type SocialPlatformAdapter,
} from './social-platform-adapters';
import { getSocialImport, saveSocialImport } from './social-import-store';
import { safeFetch } from './social-url-security';
import { incrementMetric } from './service-metrics';

const geocoder: GeocodingProvider = {
  async search(query, near) {
    const endpoint = new URL('https://nominatim.openstreetmap.org/search');
    endpoint.searchParams.set(
      'q',
      near ? `${query} near ${near.latitude},${near.longitude}` : query,
    );
    endpoint.searchParams.set('format', 'jsonv2');
    endpoint.searchParams.set('limit', '5');
    const { response, body } = await safeFetch(endpoint.href, {
      allowedHosts: new Set(['nominatim.openstreetmap.org']),
    });
    if (!response.ok) return [];
    return (
      JSON.parse(body) as Array<{
        place_id: number;
        display_name: string;
        name?: string;
        lat: string;
        lon: string;
      }>
    ).map((place) => ({
      id: String(place.place_id),
      name: place.name ?? place.display_name.split(',')[0]!,
      formattedAddress: place.display_name,
      coordinates: {
        latitude: Number(place.lat),
        longitude: Number(place.lon),
      },
    }));
  },
  async reverse() {
    return null;
  },
};

export async function processSocialImport(
  tripId: string,
  importId: string,
  dependencies: {
    adapters?: Record<string, SocialPlatformAdapter>;
    geocoder?: GeocodingProvider;
  } = {},
) {
  const original = getSocialImport(tripId, importId);
  if (!original || original.status !== 'queued') return;
  let item = saveSocialImport(transitionSocialImport(original, 'processing'));
  try {
    const adapter = (dependencies.adapters ?? createPlatformAdapters())[
      item.platform
    ];
    const postId = new URL(item.sourceUrl).pathname
      .split('/')
      .filter(Boolean)
      .at(-1)!;
    const metadata = await adapter.fetchMetadata(item.sourceUrl, postId);
    const points = getTripEditorData(tripId).points;
    const context = points.length
      ? {
          latitude:
            points.reduce((sum, point) => sum + point.latitude, 0) /
            points.length,
          longitude:
            points.reduce((sum, point) => sum + point.longitude, 0) /
            points.length,
        }
      : undefined;
    const candidates = await extractLocationCandidates(
      metadata,
      dependencies.geocoder ?? geocoder,
      context,
    );
    if (!candidates.length)
      throw new PlatformImportError(
        'metadata_unavailable',
        'No location was detected in the permitted post metadata.',
      );
    item = transitionSocialImport(item, 'needs_confirmation');
    saveSocialImport({ ...item, candidates });
  } catch (error) {
    const known = error instanceof PlatformImportError;
    const noLocation = known && error.message.startsWith('No location');
    item = transitionSocialImport(item, 'failed');
    saveSocialImport({
      ...item,
      failure: {
        code: noLocation
          ? 'no_location_detected'
          : known
            ? error.code
            : 'metadata_unavailable',
        message: known
          ? error.message
          : 'Metadata is temporarily unavailable. Try again later.',
      },
    });
  }
}

export function enqueueSocialImport(item: SocialImport) {
  saveSocialImport(item);
  incrementMetric('worker_jobs_enqueued_total');
  queueMicrotask(
    () =>
      void processSocialImport(item.tripId, item.id).finally(() =>
        incrementMetric('worker_jobs_completed_total'),
      ),
  );
}
