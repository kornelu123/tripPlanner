import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let configured = false;

export type MapLoadError = 'missing-key' | 'quota' | 'network';

export function configureGoogleMaps() {
  if (configured) return;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('missing-key');
  setOptions({
    key,
    v: 'weekly',
    mapIds: [process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID'],
    authReferrerPolicy: 'origin',
  });
  configured = true;
}

export async function loadGoogleMaps() {
  configureGoogleMaps();
  const [maps, marker, places] = await Promise.all([
    importLibrary('maps'),
    importLibrary('marker'),
    importLibrary('places'),
  ]);
  return { maps, marker, places };
}

export function mapLoadError(error: unknown): MapLoadError {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('missing-key')) return 'missing-key';
  if (message.includes('quota') || message.includes('over_query_limit'))
    return 'quota';
  return 'network';
}
