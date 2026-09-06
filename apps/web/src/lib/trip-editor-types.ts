export interface TripPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categoryId: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
}

export interface PendingImport {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  source: string;
}

export interface TripEditorData {
  trip: { id: string; name: string };
  points: TripPoint[];
  pendingImports: PendingImport[];
  categories: Category[];
  routePlan?: RoutePlan;
  previousRoutePlan?: RoutePlan;
}

export type TravelMode = 'walking' | 'driving';

export interface RouteLeg {
  fromPointId: string;
  toPointId: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: Array<{ latitude: number; longitude: number }>;
}

export interface RoutePlan {
  id: string;
  pointIds: string[];
  mode: TravelMode;
  roundTrip: boolean;
  fixedStartId?: string;
  fixedEndId?: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  optimizationMethod: 'exact' | 'heuristic' | 'manual';
  provider: { provider: string; profile: string; attribution?: string };
  legs: RouteLeg[];
}

export interface RoutePlanRequest {
  pointIds: string[];
  mode: TravelMode;
  roundTrip: boolean;
  fixedStartId?: string;
  fixedEndId?: string;
  optimize?: boolean;
}

export interface PointDraft {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categoryId?: string;
  pendingImportId?: string;
}
