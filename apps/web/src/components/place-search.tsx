'use client';

import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/google-maps';
import type { GooglePlaceData, PointDraft } from '../lib/trip-editor-types';

const displayedFields = [
  'place_id',
  'name',
  'formatted_address',
  'geometry',
  'types',
  'opening_hours',
  'website',
  'formatted_phone_number',
  'rating',
  'user_ratings_total',
  'price_level',
];

export function mapAutocompletePlace(
  place: google.maps.places.PlaceResult,
): PointDraft | null {
  const location = place.geometry?.location;
  if (!location || !place.place_id) return null;
  const googleData: GooglePlaceData = {
    googlePlaceId: place.place_id,
    name: place.name ?? 'Unnamed place',
    address: place.formatted_address ?? '',
    latitude: location.lat(),
    longitude: location.lng(),
    category: place.types?.[0],
    openNow: place.opening_hours?.isOpen?.(),
    weekdayDescriptions: place.opening_hours?.weekday_text,
    website: place.website,
    phoneNumber: place.formatted_phone_number,
    rating: place.rating,
    reviewCount: place.user_ratings_total,
    priceLevel:
      place.price_level === undefined ? undefined : String(place.price_level),
  };
  return { ...googleData, googlePlaceId: place.place_id, google: googleData };
}

export function PlaceSearch({
  bounds,
  onChoose,
  onError,
}: {
  bounds: google.maps.LatLngBounds | null;
  onChoose: (place: PointDraft) => void;
  onError: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const callbacksRef = useRef({ onChoose, onError });

  useEffect(() => {
    callbacksRef.current = { onChoose, onError };
  }, [onChoose, onError]);

  useEffect(() => {
    let active = true;
    void loadGoogleMaps()
      .then(() => {
        if (!active || !inputRef.current) return;
        const autocomplete = new google.maps.places.Autocomplete(
          inputRef.current,
          {
            fields: displayedFields,
          },
        );
        autocomplete.addListener('place_changed', () => {
          const place = mapAutocompletePlace(autocomplete.getPlace());
          if (place) callbacksRef.current.onChoose(place);
          else callbacksRef.current.onError();
        });
        autocompleteRef.current = autocomplete;
      })
      .catch(() => callbacksRef.current.onError());
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (bounds) autocompleteRef.current?.setBounds(bounds);
  }, [bounds]);

  return (
    <input
      ref={inputRef}
      id="address-search"
      placeholder="Museum, café, or address"
      aria-label="Search Google Places"
      autoComplete="off"
    />
  );
}
