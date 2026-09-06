'use client';

import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useEffect, useRef, useState } from 'react';

import { loadGoogleMaps, mapLoadError } from '@/lib/google-maps';
import { markerPresentation, shouldMoveCamera } from '@/lib/map-presentation';
import type {
  Category,
  RouteLeg,
  RoutePlan,
  TripPoint,
} from '@/lib/trip-editor-types';

interface TripMapProps {
  points: TripPoint[];
  categories: Category[];
  selectedId: string | null;
  movingPoint: TripPoint | null;
  routeOrder: string[];
  routePlan?: RoutePlan;
  onSelect: (id: string) => void;
  onAddCoordinates: (latitude: number, longitude: number) => void;
  onMoveCoordinates: (latitude: number, longitude: number) => void;
  onSelectLeg?: (leg: RouteLeg) => void;
  onBoundsChange?: (bounds: google.maps.LatLngBounds | null) => void;
  onStatus: (status: 'ready' | 'missing-key' | 'quota' | 'network') => void;
}

function markerContent(
  point: TripPoint,
  presentation: ReturnType<typeof markerPresentation>,
) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `google-trip-marker${presentation.selected ? ' selected' : ''}${presentation.completed ? ' completed' : ''}`;
  element.style.setProperty('--marker-color', presentation.color);
  element.textContent = presentation.completed
    ? `✓ ${presentation.glyph}`
    : presentation.glyph;
  element.setAttribute(
    'aria-label',
    `${presentation.selected ? 'Selected, ' : ''}${point.name}`,
  );
  return element;
}

export default function TripMap(props: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef(
    new Map<string, google.maps.marker.AdvancedMarkerElement>(),
  );
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const routeLinesRef = useRef<google.maps.Polyline[]>([]);
  const didInitialFitRef = useRef(false);
  const callbacksRef = useRef(props);
  const [exploring, setExploring] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbacksRef.current = props;
  }, [props]);

  const fitPoints = (points = callbacksRef.current.points) => {
    const map = mapRef.current;
    if (!map || !points.length) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach(({ latitude, longitude }) =>
      bounds.extend({ lat: latitude, lng: longitude }),
    );
    map.fitBounds(bounds, 64);
    setExploring(false);
  };

  useEffect(() => {
    let active = true;
    const markers = markersRef.current;
    void loadGoogleMaps()
      .then(({ maps: { Map }, marker: { AdvancedMarkerElement } }) => {
        if (!active || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center: { lat: 38.716, lng: -9.145 },
          zoom: 12,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        map.addListener('idle', () =>
          callbacksRef.current.onBoundsChange?.(map.getBounds() ?? null),
        );
        map.addListener('dragstart', () => setExploring(true));
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng && !callbacksRef.current.movingPoint)
            callbacksRef.current.onAddCoordinates(
              event.latLng.lat(),
              event.latLng.lng(),
            );
        });
        // Constructing one Advanced Marker here also verifies the map ID supports it.
        void AdvancedMarkerElement;
        callbacksRef.current.onStatus('ready');
        setReady(true);
      })
      .catch((error) => {
        if (!active) return;
        callbacksRef.current.onStatus(mapLoadError(error));
        containerRef.current?.setAttribute(
          'data-map-error',
          mapLoadError(error),
        );
      });
    return () => {
      active = false;
      clustererRef.current?.clearMarkers();
      markers.forEach((marker) => (marker.map = null));
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps?.marker) return;
    clustererRef.current?.clearMarkers();
    markersRef.current.forEach((marker) => (marker.map = null));
    markersRef.current.clear();
    for (const point of props.points) {
      const presentation = markerPresentation(
        point,
        props.categories,
        props.selectedId,
        props.routeOrder,
      );
      const content = markerContent(point, presentation);
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: point.latitude, lng: point.longitude },
        title: point.name,
        content,
        gmpClickable: true,
        zIndex: presentation.selected ? 1000 : undefined,
      });
      marker.addListener('gmp-click', () =>
        callbacksRef.current.onSelect(point.id),
      );
      markersRef.current.set(point.id, marker);
    }
    clustererRef.current = new MarkerClusterer({
      map,
      markers: [...markersRef.current.entries()]
        .filter(([id]) => id !== props.selectedId)
        .map(([, marker]) => marker),
    });
    if (!didInitialFitRef.current && props.points.length) {
      didInitialFitRef.current = true;
      fitPoints(props.points);
    }
  }, [
    props.categories,
    props.points,
    props.routeOrder,
    props.selectedId,
    ready,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const point = props.points.find(({ id }) => id === props.selectedId);
    if (!map || !point) return;
    const position = { lat: point.latitude, lng: point.longitude };
    const decision = shouldMoveCamera(
      map.getBounds()?.contains(position) ?? false,
      map.getZoom() ?? 0,
    );
    if (decision.pan) map.panTo(position);
    if (decision.zoom) map.setZoom(decision.zoom);
  }, [props.points, props.selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    routeLinesRef.current.forEach((line) => line.setMap(null));
    routeLinesRef.current = (props.routePlan?.legs ?? []).map((leg) => {
      const line = new google.maps.Polyline({
        map,
        path: leg.geometry.map(({ latitude, longitude }) => ({
          lat: latitude,
          lng: longitude,
        })),
        strokeColor: '#2f6fed',
        strokeOpacity: 0.9,
        strokeWeight: 6,
        clickable: true,
      });
      line.addListener('click', () => {
        const bounds = new google.maps.LatLngBounds();
        leg.geometry.forEach(({ latitude, longitude }) =>
          bounds.extend({ lat: latitude, lng: longitude }),
        );
        map.fitBounds(bounds, 80);
        callbacksRef.current.onSelectLeg?.(leg);
      });
      return line;
    });
  }, [props.routePlan, ready]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        mapRef.current?.panTo({ lat: coords.latitude, lng: coords.longitude }),
      () =>
        containerRef.current?.setAttribute('data-geolocation-error', 'denied'),
    );
  }

  return (
    <div className="google-map-shell">
      <div
        className="trip-map"
        ref={containerRef}
        role="region"
        aria-label="Trip points map"
        data-route-segments={props.routePlan?.legs.length ?? 0}
      />
      <div className="google-map-controls" aria-label="Map controls">
        <button type="button" onClick={() => fitPoints()}>
          Show all points
        </button>
        <button type="button" onClick={useMyLocation}>
          My location
        </button>
        {exploring && (
          <button type="button" onClick={() => fitPoints()}>
            Back to route
          </button>
        )}
      </div>
    </div>
  );
}
