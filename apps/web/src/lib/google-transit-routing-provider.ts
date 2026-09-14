import type {
  Coordinates,
  DurationMatrix,
  Route,
  RouteRequest,
  RouteStep,
  RoutingProvider,
  TransitDetails,
} from '@trip-planner/domain';

import { incrementMetric, observeMetric } from './service-metrics';

interface GoogleLatLng {
  latitude: number;
  longitude: number;
}

interface GoogleTransitDetails {
  stopDetails?: {
    arrivalStop?: { name?: string; location?: { latLng?: GoogleLatLng } };
    arrivalTime?: string;
    departureStop?: { name?: string; location?: { latLng?: GoogleLatLng } };
    departureTime?: string;
  };
  headsign?: string;
  stopCount?: number;
  transitLine?: {
    agencies?: Array<{ name?: string }>;
    name?: string;
    nameShort?: string;
    vehicle?: { name?: { text?: string }; type?: string };
  };
}

interface GoogleRouteResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
    legs?: Array<{
      steps?: Array<{
        distanceMeters?: number;
        staticDuration?: string;
        travelMode?: string;
        navigationInstruction?: { instructions?: string };
        transitDetails?: GoogleTransitDetails;
      }>;
    }>;
  }>;
}

export class GoogleTransitRoutingProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'unavailable' | 'invalid-response' | 'unreachable',
  ) {
    super(message);
    this.name = 'GoogleTransitRoutingProviderError';
  }
}

function seconds(value?: string) {
  const parsed = Number(value?.replace(/s$/, ''));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function decodePolyline(encoded: string): Coordinates[] {
  const path: Coordinates[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    const values: number[] = [];
    for (let coordinate = 0; coordinate < 2; coordinate++) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      values.push(result & 1 ? ~(result >> 1) : result >> 1);
    }
    latitude += values[0]!;
    longitude += values[1]!;
    path.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return path;
}

function stop(
  value: { name?: string; location?: { latLng?: GoogleLatLng } } | undefined,
) {
  const coordinates = value?.location?.latLng;
  if (!value?.name || !coordinates) return undefined;
  return { name: value.name, coordinates };
}

function transitDetails(
  value?: GoogleTransitDetails,
): TransitDetails | undefined {
  const arrivalStop = stop(value?.stopDetails?.arrivalStop);
  const departureStop = stop(value?.stopDetails?.departureStop);
  const arrivalTime = value?.stopDetails?.arrivalTime;
  const departureTime = value?.stopDetails?.departureTime;
  const vehicle = value?.transitLine?.vehicle;
  if (
    !arrivalStop ||
    !departureStop ||
    !arrivalTime ||
    !departureTime ||
    !value?.headsign ||
    !value.transitLine?.name ||
    !vehicle?.name?.text ||
    !vehicle.type
  )
    return undefined;
  return {
    arrivalStop,
    arrivalTime,
    departureStop,
    departureTime,
    headsign: value.headsign,
    lineName: value.transitLine.name,
    lineShortName: value.transitLine.nameShort,
    agencyName: value.transitLine.agencies?.[0]?.name,
    vehicleName: vehicle.name.text,
    vehicleType: vehicle.type as TransitDetails['vehicleType'],
    stopCount: value.stopCount ?? 0,
  };
}

export class GoogleTransitRoutingProvider implements RoutingProvider {
  constructor(
    private readonly apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY,
    private readonly request = fetch,
    private readonly endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes',
  ) {}

  private async route(
    origin: Coordinates,
    destination: Coordinates,
    departureTime: string,
  ): Promise<Route> {
    if (!this.apiKey)
      throw new GoogleTransitRoutingProviderError(
        'Public transit routing is not configured.',
        'unavailable',
      );
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await this.request(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask':
            'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.transitDetails',
        },
        body: JSON.stringify({
          origin: { location: { latLng: origin } },
          destination: { location: { latLng: destination } },
          travelMode: 'TRANSIT',
          departureTime,
          computeAlternativeRoutes: false,
          languageCode: 'en',
          units: 'METRIC',
        }),
      });
    } catch {
      throw new GoogleTransitRoutingProviderError(
        'The public transit provider is currently unavailable.',
        'unavailable',
      );
    }
    observeMetric(
      'routing_latency_milliseconds',
      performance.now() - startedAt,
    );
    if (!response.ok) {
      if (response.status === 429)
        incrementMetric('provider_rate_limits_total');
      throw new GoogleTransitRoutingProviderError(
        'The public transit provider returned an error.',
        'unavailable',
      );
    }
    const result = (await response.json()) as GoogleRouteResponse;
    const route = result.routes?.[0];
    if (!route)
      throw new GoogleTransitRoutingProviderError(
        'No scheduled public transit route exists between these stops.',
        'unreachable',
      );
    const encodedPolyline = route.polyline?.encodedPolyline;
    if (
      route.distanceMeters === undefined ||
      !route.duration ||
      !encodedPolyline
    )
      throw new GoogleTransitRoutingProviderError(
        'The public transit provider returned an invalid route.',
        'invalid-response',
      );
    const steps: RouteStep[] =
      route.legs?.flatMap((leg) =>
        (leg.steps ?? []).map((step) => ({
          distanceMeters: step.distanceMeters ?? 0,
          durationSeconds: seconds(step.staticDuration),
          instructions: step.navigationInstruction?.instructions,
          mode:
            step.travelMode === 'TRANSIT'
              ? ('transit' as const)
              : ('walking' as const),
          transit: transitDetails(step.transitDetails),
        })),
      ) ?? [];
    const scheduledSteps = steps.flatMap((step) =>
      step.transit ? [step.transit] : [],
    );
    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: seconds(route.duration),
      path: decodePolyline(encodedPolyline),
      steps,
      departureTime: scheduledSteps[0]?.departureTime ?? departureTime,
      arrivalTime: scheduledSteps.at(-1)?.arrivalTime,
      metadata: {
        provider: 'google-routes',
        profile: 'transit',
        attribution: 'Transit directions by Google',
      },
    };
  }

  async durationMatrix(
    points: Coordinates[],
    _mode: 'transit',
    departureTime = new Date().toISOString(),
  ): Promise<DurationMatrix> {
    const durations = await Promise.all(
      points.map((origin, from) =>
        Promise.all(
          points.map(async (destination, to) => {
            if (from === to) return 0;
            try {
              return (await this.route(origin, destination, departureTime))
                .durationSeconds;
            } catch (error) {
              if (
                error instanceof GoogleTransitRoutingProviderError &&
                error.kind === 'unreachable'
              )
                return null;
              throw error;
            }
          }),
        ),
      ),
    );
    return {
      durations,
      metadata: {
        provider: 'google-routes',
        profile: 'transit',
        attribution: 'Transit directions by Google',
      },
    };
  }

  calculateRoute(request: RouteRequest): Promise<Route> {
    if (!request.departureTime)
      throw new GoogleTransitRoutingProviderError(
        'A departure time is required for public transit.',
        'invalid-response',
      );
    return this.route(
      request.origin,
      request.destination,
      request.departureTime,
    );
  }
}
