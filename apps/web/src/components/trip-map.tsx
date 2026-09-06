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
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useEffect, useRef } from 'react';

import type { Category, RoutePlan, TripPoint } from '@/lib/trip-editor-types';

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
  onStatus: (status: 'ready' | 'error') => void;
}

function pointCollection(
  points: TripPoint[],
  categories: Category[],
  routePlan?: RoutePlan,
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      properties: {
        id: point.id,
        number: routePlan ? routePlan.pointIds.indexOf(point.id) + 1 : '',
        color:
          categories.find(({ id }) => id === point.categoryId)?.color ??
          '#687c76',
      },
      geometry: {
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
      },
    })),
  };
}

function routeCollection(
  points: TripPoint[],
  routeOrder: string[],
  routePlan?: RoutePlan,
): FeatureCollection<LineString> {
  const orderedPoints = routeOrder
    .map((id) => points.find((point) => point.id === id))
    .filter((point): point is TripPoint => Boolean(point));
  return {
    type: 'FeatureCollection',
    features: routePlan
      ? routePlan.legs.map((leg) => ({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: leg.geometry.map(({ longitude, latitude }) => [
              longitude,
              latitude,
            ]),
          },
        }))
      : orderedPoints.length > 1
        ? [
            {
              type: 'Feature',
              properties: { preview: true },
              geometry: {
                type: 'LineString',
                coordinates: orderedPoints.map(({ longitude, latitude }) => [
                  longitude,
                  latitude,
                ]),
              },
            },
          ]
        : [],
  };
}

export default function TripMap({
  points,
  categories,
  selectedId,
  movingPoint,
  routeOrder,
  routePlan,
  onSelect,
  onAddCoordinates,
  onMoveCoordinates,
  onStatus,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const moveMarkerRef = useRef<Marker | null>(null);
  const movingPointRef = useRef(movingPoint);
  const pointsRef = useRef(points);
  const categoriesRef = useRef(categories);
  const selectedIdRef = useRef(selectedId);
  const routePlanRef = useRef(routePlan);
  const routeOrderRef = useRef(routeOrder);
  const callbacksRef = useRef({
    onSelect,
    onAddCoordinates,
    onMoveCoordinates,
    onStatus,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSelect,
      onAddCoordinates,
      onMoveCoordinates,
      onStatus,
    };
    movingPointRef.current = movingPoint;
    pointsRef.current = points;
    categoriesRef.current = categories;
    selectedIdRef.current = selectedId;
    routePlanRef.current = routePlan;
    routeOrderRef.current = routeOrder;
  }, [
    movingPoint,
    onAddCoordinates,
    onMoveCoordinates,
    onStatus,
    onSelect,
    points,
    categories,
    selectedId,
    routePlan,
    routeOrder,
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
            tiles: [
              'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors © CARTO',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
    });
    map.addControl(new NavigationControl(), 'top-right');
    map.on('load', () => {
      callbacksRef.current.onStatus('ready');
      map.addSource('trip-points', {
        type: 'geojson',
        data: pointCollection(
          pointsRef.current,
          categoriesRef.current,
          routePlanRef.current,
        ),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
      });
      map.addSource('trip-route', {
        type: 'geojson',
        data: routeCollection(
          pointsRef.current,
          routeOrderRef.current,
          routePlanRef.current,
        ),
      });
      map.addLayer({
        id: 'trip-route-casing',
        type: 'line',
        source: 'trip-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#1a5dcc',
          'line-width': 9,
          'line-opacity': 0.72,
          'line-dasharray': [1, 0],
        },
      });
      map.addLayer({
        id: 'trip-route-line',
        type: 'line',
        source: 'trip-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#4285f4',
          'line-width': 6,
          'line-opacity': 1,
        },
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
        id: 'point-numbers',
        type: 'symbol',
        source: 'trip-points',
        filter: [
          'all',
          ['!', ['has', 'point_count']],
          ['!=', ['get', 'number'], ''],
        ],
        layout: {
          'text-field': ['to-string', ['get', 'number']],
          'text-size': 11,
        },
        paint: { 'text-color': '#fff' },
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
        pointCollection(points, categories, routePlan),
      );
      (map.getSource('trip-route') as GeoJSONSource | undefined)?.setData(
        routeCollection(points, routeOrder, routePlan),
      );
      if (map.getLayer('trip-route-casing')) {
        map.setPaintProperty(
          'trip-route-casing',
          'line-dasharray',
          routePlan ? [1, 0] : [1, 1.5],
        );
        map.setPaintProperty(
          'trip-route-line',
          'line-dasharray',
          routePlan ? [1, 0] : [1, 1.5],
        );
      }
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
  }, [categories, points, routeOrder, routePlan, selectedId]);

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
    <div
      className="trip-map"
      ref={containerRef}
      role="region"
      aria-label="Trip points map"
      data-route-segments={
        routePlan?.legs.length ?? Math.max(0, routeOrder.length - 1)
      }
    />
  );
}
