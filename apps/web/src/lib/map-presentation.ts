import type { Category, GooglePlaceData, TripPoint } from './trip-editor-types';

export const placeDetailZoom = 16;

export function shouldMoveCamera(
  isVisible: boolean,
  currentZoom: number,
): { pan: boolean; zoom?: number } {
  const zoom = currentZoom < placeDetailZoom ? placeDetailZoom : undefined;
  return {
    pan: !isVisible || zoom !== undefined,
    zoom,
  };
}

export function markerPresentation(
  point: TripPoint,
  categories: Category[],
  selectedId: string | null,
  routeOrder: string[],
) {
  const category = categories.find(({ id }) => id === point.categoryId);
  const routeIndex = routeOrder.indexOf(point.id);
  return {
    color: category?.color ?? '#687c76',
    glyph: routeIndex >= 0 ? String(routeIndex + 1) : (category?.icon ?? '•'),
    selected: selectedId === point.id,
    completed: point.visitStatus === 'completed',
  };
}

export function mapGooglePlace(
  place: google.maps.places.Place,
): GooglePlaceData {
  const location = place.location;
  return {
    googlePlaceId: place.id,
    name: place.displayName ?? 'Unnamed place',
    address: place.formattedAddress ?? '',
    latitude: location?.lat() ?? 0,
    longitude: location?.lng() ?? 0,
    category: place.primaryTypeDisplayName ?? place.primaryType ?? undefined,
    weekdayDescriptions: place.regularOpeningHours?.weekdayDescriptions,
    website: place.websiteURI ?? undefined,
    phoneNumber: place.nationalPhoneNumber ?? undefined,
    rating: place.rating ?? undefined,
    reviewCount: place.userRatingCount ?? undefined,
    priceLevel: place.priceLevel ?? undefined,
  };
}
