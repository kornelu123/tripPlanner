'use client';

import {
  GeoJSONSource,
  LngLatBounds,
  Map,
  Marker,
  NavigationControl,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { useEffect, useRef } from 'react';

import type { TripPoint } from '@/lib/trip-editor-types';

interface TripMapProps {
  points: TripPoint[];
  selectedId: string | null;
  movingPoint: TripPoint | null;
  onSelect: (id: string) => void;
  onAddCoordinates: (latitude: number, longitude: number) => void;
  onMoveCoordinates: (latitude: number, longitude: number) => void;
}

const categoryColors: Record<string, string> = {
  Food: '#dc6941',
  Culture: '#735da5',
  Outdoors: '#397a65',
  Stay: '#3573a5',
};

function pointCollection(points: TripPoint[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      properties: {
        id: point.id,
        color: categoryColors[point.category] ?? '#397a65',
      },
      geometry: {
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
      },
    })),
  };
}

export default function TripMap({
  points,
  selectedId,
  movingPoint,
  onSelect,
  onAddCoordinates,
  onMoveCoordinates,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const moveMarkerRef = useRef<Marker | null>(null);
  const movingPointRef = useRef(movingPoint);
  const pointsRef = useRef(points);
  const selectedIdRef = useRef(selectedId);
  const callbacksRef = useRef({
    onSelect,
    onAddCoordinates,
    onMoveCoordinates,
  });

  useEffect(() => {
    callbacksRef.current = { onSelect, onAddCoordinates, onMoveCoordinates };
    movingPointRef.current = movingPoint;
    pointsRef.current = points;
    selectedIdRef.current = selectedId;
  }, [
    movingPoint,
    onAddCoordinates,
    onMoveCoordinates,
    onSelect,
    points,
    selectedId,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new Map({
      container: containerRef.current,
      center: [-9.145, 38.716],
      zoom: 12,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
    });
    map.addControl(new NavigationControl(), 'top-right');
    map.on('load', () => {
      map.addSource('trip-points', {
        type: 'geojson',
        data: pointCollection(pointsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
      });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'trip-points',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#183d34',
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'trip-points',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: { 'text-color': '#fff' },
      });
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'trip-points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedIdRef.current ?? ''],
            11,
            8,
          ],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      });
      map.on('click', 'points', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (id) callbacksRef.current.onSelect(id);
      });
      map.on('click', 'clusters', async (event: MapLayerMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, {
          layers: ['clusters'],
        })[0];
        const clusterId = feature?.properties?.cluster_id as number | undefined;
        if (!feature || clusterId === undefined) return;
        const source = map.getSource('trip-points') as GeoJSONSource;
        map.easeTo({
          center: (feature.geometry as Point).coordinates as [number, number],
          zoom: await source.getClusterExpansionZoom(clusterId),
        });
      });
      map.on('click', (event: MapMouseEvent) => {
        if (
          movingPointRef.current ||
          map.queryRenderedFeatures(event.point, {
            layers: ['points', 'clusters'],
          }).length
        )
          return;
        callbacksRef.current.onAddCoordinates(
          event.lngLat.lat,
          event.lngLat.lng,
        );
      });
    });
    mapRef.current = map;
    return () => {
      moveMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      (map.getSource('trip-points') as GeoJSONSource | undefined)?.setData(
        pointCollection(points),
      );
      if (map.getLayer('points')) {
        map.setPaintProperty('points', 'circle-radius', [
          'case',
          ['==', ['get', 'id'], selectedId ?? ''],
          11,
          8,
        ]);
      }
      if (points.length) {
        const bounds = new LngLatBounds();
        points.forEach(({ longitude, latitude }) =>
          bounds.extend([longitude, latitude]),
        );
        map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 0 });
      }
    };
    if (map.loaded()) update();
    else map.once('load', update);
  }, [points, selectedId]);

  useEffect(() => {
    moveMarkerRef.current?.remove();
    moveMarkerRef.current = null;
    if (!movingPoint || !mapRef.current) return;
    const marker = new Marker({ draggable: true, color: '#e96f43' })
      .setLngLat([movingPoint.longitude, movingPoint.latitude])
      .addTo(mapRef.current);
    marker.on('dragend', () => {
      const coordinates = marker.getLngLat();
      callbacksRef.current.onMoveCoordinates(coordinates.lat, coordinates.lng);
    });
    moveMarkerRef.current = marker;
  }, [movingPoint]);

  return (
    <div className="trip-map" ref={containerRef} aria-label="Trip points map" />
  );
}
