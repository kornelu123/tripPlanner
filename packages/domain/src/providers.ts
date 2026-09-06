export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  name: string;
  coordinates: Coordinates;
  formattedAddress?: string;
}

export type TravelMode = 'driving' | 'walking';

export interface ProviderMetadata {
  provider: string;
  profile: string;
  attribution?: string;
}

export interface DurationMatrix {
  durations: (number | null)[][];
  metadata: ProviderMetadata;
}

export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  waypoints?: Coordinates[];
  mode: TravelMode;
}

export interface Route {
  distanceMeters: number;
  durationSeconds: number;
  path: Coordinates[];
  metadata: ProviderMetadata;
}

export interface RoutingProvider {
  durationMatrix(
    points: Coordinates[],
    mode: TravelMode,
  ): Promise<DurationMatrix>;
  calculateRoute(request: RouteRequest): Promise<Route>;
}

export interface RouteOptimizationRequest {
  durations: (number | null)[][];
  roundTrip: boolean;
  fixedStart?: number;
  fixedEnd?: number;
}

export interface OptimizedRoute {
  order: number[];
  durationSeconds: number;
  method: 'exact' | 'heuristic';
}

export interface RouteOptimizer {
  optimize(request: RouteOptimizationRequest): OptimizedRoute;
}

export class UnreachableRouteError extends Error {
  constructor(message = 'No route can reach every selected stop.') {
    super(message);
    this.name = 'UnreachableRouteError';
  }
}

export interface GeocodingProvider {
  search(query: string, near?: Coordinates): Promise<Place[]>;
  reverse(coordinates: Coordinates): Promise<Place | null>;
}

export interface SocialPost {
  id: string;
  authorName: string;
  text: string;
  url: string;
  publishedAt: Date;
  location?: Coordinates;
}

export interface SocialSearchRequest {
  query: string;
  near?: Coordinates;
  limit?: number;
}

export interface SocialPlatformProvider {
  searchPosts(request: SocialSearchRequest): Promise<SocialPost[]>;
}

export type PriceLevel = 'budget' | 'moderate' | 'expensive' | 'premium';
export type PriceUnit =
  | 'per_person'
  | 'admission'
  | 'typical_meal'
  | 'per_night'
  | 'other';
export type PriceSourceType =
  | 'official_api'
  | 'ticketing_api'
  | 'search_result'
  | 'official_structured_data'
  | 'public_page'
  | 'local_average';

export interface PriceResearchInput {
  placeName: string;
  category: string;
  coordinates: Coordinates;
  formattedAddress: string;
  currency: string;
  country: string;
}

export interface OriginalPrice {
  amount: number;
  currency: string;
  exchangeRateDate?: string;
}

export interface AdmissionPrice {
  audience: 'adult' | 'child' | 'student' | 'senior' | 'general';
  amount: number;
  currency: string;
  original?: OriginalPrice;
}

export interface PriceSource {
  url: string;
  type: PriceSourceType;
  retrievedAt: Date;
}

export interface PriceResearchResult {
  priceLevel: PriceLevel;
  minimumAmount?: number;
  maximumAmount?: number;
  currency: string;
  unit: PriceUnit;
  sourceUrl: string;
  sourceType: PriceSourceType;
  retrievedAt: Date;
  confidence: number;
  sources?: PriceSource[];
  admissionPrices?: AdmissionPrice[];
  originalMinimum?: OriginalPrice;
  originalMaximum?: OriginalPrice;
}

/** Implementations convert SDK responses before crossing this boundary. */
export interface PriceResearchProvider {
  research(input: PriceResearchInput): Promise<PriceResearchResult | null>;
}
