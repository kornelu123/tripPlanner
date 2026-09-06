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

export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  waypoints?: Coordinates[];
  mode: 'driving' | 'walking' | 'cycling' | 'transit';
}

export interface Route {
  distanceMeters: number;
  durationSeconds: number;
  path: Coordinates[];
}

export interface RoutingProvider {
  calculateRoute(request: RouteRequest): Promise<Route>;
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
