export interface TripPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categoryId: string;
  googlePlaceId?: string;
  google?: GooglePlaceData;
  notes?: string;
  customCategory?: string;
  plannedDurationMinutes?: number;
  visitStatus?: 'planned' | 'completed';
  itineraryOrder?: number;
  socialSourceUrl?: string;
  price?: PlacePrice;
}

export interface GooglePlaceData {
  googlePlaceId?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  openNow?: boolean;
  weekdayDescriptions?: string[];
  website?: string;
  phoneNumber?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
}

export interface PlacePrice {
  status: 'loading' | 'unavailable' | 'success';
  priceLevel?: 'budget' | 'moderate' | 'expensive' | 'premium';
  minimumAmount?: number;
  maximumAmount?: number;
  currency?: string;
  unit?: 'per_person' | 'admission' | 'typical_meal' | 'per_night' | 'other';
  sources?: Array<{ url: string; type: string }>;
  confidence?: number;
  lastCheckedAt?: string;
  stale?: boolean;
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
  googlePlaceId?: string;
  google?: GooglePlaceData;
}
