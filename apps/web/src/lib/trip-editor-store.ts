import type {
  PointDraft,
  TripEditorData,
  TripPoint,
} from './trip-editor-types';

const categories = ['Food', 'Culture', 'Outdoors', 'Stay'];

const stores = new Map<string, TripEditorData>();

function createTrip(tripId: string): TripEditorData {
  return {
    trip: { id: tripId, name: 'Lisbon long weekend' },
    categories,
    points: [
      {
        id: 'miradouro',
        name: 'Miradouro da Senhora',
        address: 'Largo Monte, 1170-107 Lisboa',
        latitude: 38.7191,
        longitude: -9.1328,
        category: 'Outdoors',
      },
      {
        id: 'time-out-market',
        name: 'Time Out Market',
        address: 'Av. 24 de Julho 49, Lisboa',
        latitude: 38.707,
        longitude: -9.1457,
        category: 'Food',
      },
      {
        id: 'gulbenkian',
        name: 'Calouste Gulbenkian Museum',
        address: 'Av. de Berna 45A, Lisboa',
        latitude: 38.7376,
        longitude: -9.1546,
        category: 'Culture',
      },
    ],
    pendingImports: [
      {
        id: 'social-pasteis',
        name: 'Pastéis de Belém',
        address: 'R. de Belém 84 92, Lisboa',
        latitude: 38.6975,
        longitude: -9.2032,
        source: 'Saved from Instagram',
      },
      {
        id: 'social-lx-factory',
        name: 'LX Factory',
        address: 'R. Rodrigues de Faria 103, Lisboa',
        latitude: 38.7037,
        longitude: -9.178,
        source: 'Saved from TikTok',
      },
    ],
  };
}

export function getTripEditorData(tripId: string): TripEditorData {
  let data = stores.get(tripId);
  if (!data) {
    data = createTrip(tripId);
    stores.set(tripId, data);
  }
  return data;
}

export function addTripPoint(tripId: string, draft: PointDraft): TripPoint {
  const data = getTripEditorData(tripId);
  const point = {
    ...draft,
    id: crypto.randomUUID(),
    category: draft.category ?? 'Outdoors',
  };
  data.points.push(point);
  if (draft.pendingImportId) {
    data.pendingImports = data.pendingImports.filter(
      ({ id }) => id !== draft.pendingImportId,
    );
  }
  return point;
}

export function updateTripPoint(
  tripId: string,
  pointId: string,
  update: Partial<TripPoint>,
): TripPoint | undefined {
  const point = getTripEditorData(tripId).points.find(
    ({ id }) => id === pointId,
  );
  if (point) Object.assign(point, update);
  return point;
}

export function deleteTripPoint(tripId: string, pointId: string): boolean {
  const data = getTripEditorData(tripId);
  const previousLength = data.points.length;
  data.points = data.points.filter(({ id }) => id !== pointId);
  return data.points.length !== previousLength;
}
