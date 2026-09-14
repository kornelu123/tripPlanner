import { describe, expect, it } from 'vitest';

import {
  extractLocationCandidates,
  transitionSocialImport,
} from './social-import';
import type { GeocodingProvider, Place } from './providers';
import type { SocialImport } from './social-import';
import metadata from './__fixtures__/social-metadata.json';

const places: Place[] = [
  {
    id: 'far',
    name: 'Central Market',
    formattedAddress: 'Valencia, Spain',
    coordinates: { latitude: 39.47, longitude: -0.38 },
  },
  {
    id: 'near',
    name: 'Central Market',
    formattedAddress: 'Lisbon, Portugal',
    coordinates: { latitude: 38.71, longitude: -9.14 },
  },
];
const geocoder: GeocodingProvider = {
  search: async () => places,
  reverse: async () => null,
};

describe('SocialImport', () => {
  it('allows only declared state transitions', () => {
    const item: SocialImport = {
      id: '1',
      tripId: 'trip',
      sourceUrl: 'https://example.test',
      platform: 'instagram',
      status: 'queued',
      candidates: [],
      createdAt: '',
      updatedAt: '',
    };
    expect(transitionSocialImport(item, 'processing').status).toBe(
      'processing',
    );
    expect(() => transitionSocialImport(item, 'completed')).toThrow(/Invalid/);
  });

  it('extracts evidence and uses trip context to rank ambiguous locations', async () => {
    const candidates = await extractLocationCandidates(
      { ...metadata, platform: 'instagram' },
      geocoder,
      { latitude: 38.72, longitude: -9.14 },
    );
    expect(candidates.map(({ id }) => id)).toEqual(['near', 'far']);
    expect(candidates[0]).toMatchObject({
      confidence: 0.55,
      evidence: [{ text: 'Central Market', source: 'caption' }],
    });
  });

  it('extracts multiple locations from labels, natural language, and hashtags', async () => {
    const searches: string[] = [];
    await extractLocationCandidates(
      {
        ...metadata,
        platform: 'instagram',
        caption:
          'Location: Alfama\nDinner at Central Market. Next stop: Belém Tower #Lisbon',
      },
      {
        search: async (query) => {
          searches.push(query);
          return [];
        },
        reverse: async () => null,
      },
    );
    expect(searches).toEqual([
      'Alfama',
      'Central Market',
      'Belém Tower',
      'Lisbon',
    ]);
  });
});
