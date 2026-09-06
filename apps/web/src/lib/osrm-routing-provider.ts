import type {
  Coordinates,
  DurationMatrix,
  Route,
  RouteRequest,
  RoutingProvider,
  TravelMode,
} from '@trip-planner/domain';

interface OsrmTableResponse {
  code: string;
  durations?: (number | null)[][];
  message?: string;
}

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
}

export class RoutingProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'unavailable' | 'invalid-response' | 'unreachable',
  ) {
    super(message);
    this.name = 'RoutingProviderError';
  }
}

const profiles: Record<TravelMode, string> = {
  driving: 'driving',
  walking: 'walking',
};

function coordinatesPath(points: Coordinates[]) {
  return points
    .map(({ latitude, longitude }) => `${longitude},${latitude}`)
    .join(';');
}

export class OsrmRoutingProvider implements RoutingProvider {
  constructor(
    private readonly baseUrl = process.env.OSRM_BASE_URL ??
      'https://router.project-osrm.org',
    private readonly request = fetch,
  ) {}

  private async get<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await this.request(`${this.baseUrl}${path}`);
    } catch {
      throw new RoutingProviderError(
        'The routing provider is currently unavailable.',
        'unavailable',
      );
    }
    if (!response.ok) {
      throw new RoutingProviderError(
        'The routing provider returned an error.',
        'unavailable',
      );
    }
    return (await response.json()) as T;
  }

  async durationMatrix(
    points: Coordinates[],
    mode: TravelMode,
  ): Promise<DurationMatrix> {
    const profile = profiles[mode];
    const result = await this.get<OsrmTableResponse>(
      `/table/v1/${profile}/${coordinatesPath(points)}?annotations=duration`,
    );
    if (result.code !== 'Ok' || !result.durations) {
      throw new RoutingProviderError(
        result.message ?? 'The provider returned an invalid duration matrix.',
        'invalid-response',
      );
    }
    return {
      durations: result.durations,
      metadata: {
        provider: 'osrm',
        profile,
        attribution: 'Routing by OSRM',
      },
    };
  }

  async calculateRoute({
    origin,
    destination,
    waypoints = [],
    mode,
  }: RouteRequest): Promise<Route> {
    const profile = profiles[mode];
    const result = await this.get<OsrmRouteResponse>(
      `/route/v1/${profile}/${coordinatesPath([origin, ...waypoints, destination])}?overview=full&geometries=geojson&steps=false`,
    );
    const route = result.routes?.[0];
    if (result.code === 'NoRoute' || !route) {
      throw new RoutingProviderError(
        'No provider-backed route exists between these stops.',
        'unreachable',
      );
    }
    if (result.code !== 'Ok' || !Array.isArray(route.geometry.coordinates)) {
      throw new RoutingProviderError(
        result.message ?? 'The provider returned invalid route geometry.',
        'invalid-response',
      );
    }
    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      path: route.geometry.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })),
      metadata: {
        provider: 'osrm',
        profile,
        attribution: 'Routing by OSRM',
      },
    };
  }
}
