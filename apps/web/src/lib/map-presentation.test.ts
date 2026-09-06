import { describe, expect, it } from 'vitest';
import {
  mapGooglePlace,
  markerPresentation,
  shouldMoveCamera,
} from './map-presentation';
import { mapLoadError } from './google-maps';

describe('map presentation', () => {
  it('does not disorient users when a selected place is already visible and close', () => {
    expect(shouldMoveCamera(true, 17)).toEqual({ pan: false, zoom: undefined });
    expect(shouldMoveCamera(true, 12)).toEqual({ pan: true, zoom: 16 });
    expect(shouldMoveCamera(false, 12)).toEqual({ pan: true, zoom: 16 });
  });

  it('numbers route markers and makes completion non-color-only', () => {
    const point = {
      id: 'b',
      name: 'B',
      address: '',
      latitude: 1,
      longitude: 2,
      categoryId: 'food',
      visitStatus: 'completed' as const,
    };
    expect(
      markerPresentation(
        point,
        [
          {
            id: 'food',
            name: 'Food',
            color: '#f00',
            icon: 'fork-knife',
            position: 0,
          },
        ],
        'b',
        ['a', 'b'],
      ),
    ).toMatchObject({ glyph: '2', selected: true, completed: true });
  });

  it('maps only displayed Google fields', () => {
    const place = {
      id: 'ChIJ1',
      displayName: 'Cafe',
      formattedAddress: 'Main St',
      location: { lat: () => 1, lng: () => 2 },
      rating: 4.6,
      userRatingCount: 42,
    } as google.maps.places.Place;
    expect(mapGooglePlace(place)).toMatchObject({
      googlePlaceId: 'ChIJ1',
      name: 'Cafe',
      latitude: 1,
      rating: 4.6,
      reviewCount: 42,
    });
  });

  it('maps quota and network failures to explicit UI states', () => {
    expect(mapLoadError(new Error('OVER_QUERY_LIMIT quota'))).toBe('quota');
    expect(mapLoadError(new Error('request failed'))).toBe('network');
  });
});
