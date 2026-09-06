import type {
  Category,
  PointDraft,
  TripEditorData,
  TripPoint,
  RoutePlan,
} from './trip-editor-types';

export const allowedCategoryIcons = [
  'fork-knife',
  'landmark',
  'tree',
  'bed',
  'pin',
] as const;
const defaultCategories: Omit<Category, 'id'>[] = [
  { name: 'Uncategorized', color: '#687c76', icon: 'pin', position: 0 },
  { name: 'Food', color: '#dc6941', icon: 'fork-knife', position: 1 },
  { name: 'Culture', color: '#735da5', icon: 'landmark', position: 2 },
  { name: 'Outdoors', color: '#397a65', icon: 'tree', position: 3 },
  { name: 'Stay', color: '#3573a5', icon: 'bed', position: 4 },
];

const stores = new Map<string, TripEditorData>();
const owners = new Map<string, string>();

function createTrip(tripId: string): TripEditorData {
  const categories = defaultCategories.map((category) => ({
    ...category,
    id: `${tripId}-${category.name.toLowerCase()}`,
  }));
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
        categoryId: `${tripId}-outdoors`,
      },
      {
        id: 'time-out-market',
        name: 'Time Out Market',
        address: 'Av. 24 de Julho 49, Lisboa',
        latitude: 38.707,
        longitude: -9.1457,
        categoryId: `${tripId}-food`,
      },
      {
        id: 'gulbenkian',
        name: 'Calouste Gulbenkian Museum',
        address: 'Av. de Berna 45A, Lisboa',
        latitude: 38.7376,
        longitude: -9.1546,
        categoryId: `${tripId}-culture`,
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

export function saveRoutePlan(tripId: string, routePlan: RoutePlan): RoutePlan {
  const data = getTripEditorData(tripId);
  data.previousRoutePlan = data.routePlan;
  data.routePlan = routePlan;
  return routePlan;
}

export function restorePreviousRoutePlan(
  tripId: string,
): RoutePlan | undefined {
  const data = getTripEditorData(tripId);
  if (!data.previousRoutePlan) return undefined;
  const current = data.routePlan;
  data.routePlan = data.previousRoutePlan;
  data.previousRoutePlan = current;
  return data.routePlan;
}

export function getTripEditorData(tripId: string): TripEditorData {
  let data = stores.get(tripId);
  if (!data) {
    data = createTrip(tripId);
    stores.set(tripId, data);
    owners.set(tripId, 'demo-user');
  }
  return data;
}

export function canEditTrip(tripId: string, userId: string): boolean {
  getTripEditorData(tripId);
  return owners.get(tripId) === userId;
}

export function addTripPoint(tripId: string, draft: PointDraft): TripPoint {
  const data = getTripEditorData(tripId);
  const point = {
    ...draft,
    id: crypto.randomUUID(),
    categoryId: draft.categoryId ?? `${tripId}-uncategorized`,
  };
  data.points.push(point);
  if (draft.pendingImportId) {
    data.pendingImports = data.pendingImports.filter(
      ({ id }) => id !== draft.pendingImportId,
    );
  }
  return point;
}

export function listCategories(tripId: string): Category[] {
  return getTripEditorData(tripId).categories;
}

export function addCategory(
  tripId: string,
  input: Pick<Category, 'name' | 'color' | 'icon'>,
): Category {
  const data = getTripEditorData(tripId);
  const category = {
    ...input,
    id: crypto.randomUUID(),
    position: data.categories.length,
  };
  data.categories.push(category);
  return category;
}

export function updateCategory(
  tripId: string,
  categoryId: string,
  update: Partial<Pick<Category, 'name' | 'color' | 'icon' | 'position'>>,
): Category | undefined {
  const data = getTripEditorData(tripId);
  const category = data.categories.find(({ id }) => id === categoryId);
  if (!category) return undefined;
  if (update.position !== undefined) {
    const currentIndex = data.categories.indexOf(category);
    const targetIndex = Math.min(update.position, data.categories.length - 1);
    data.categories.splice(currentIndex, 1);
    data.categories.splice(targetIndex, 0, category);
    data.categories.forEach((item, position) => (item.position = position));
  }
  if (update.name !== undefined) category.name = update.name;
  if (update.color !== undefined) category.color = update.color;
  if (update.icon !== undefined) category.icon = update.icon;
  return category;
}

export function deleteCategory(
  tripId: string,
  categoryId: string,
  reassignToId?: string,
): boolean {
  const data = getTripEditorData(tripId);
  const category = data.categories.find(({ id }) => id === categoryId);
  if (!category || category.name === 'Uncategorized') return false;
  const fallback = reassignToId
    ? data.categories.find(({ id }) => id === reassignToId)
    : data.categories.find(({ name }) => name === 'Uncategorized');
  if (!fallback || fallback.id === categoryId) return false;
  data.points.forEach((point) => {
    if (point.categoryId === categoryId) point.categoryId = fallback.id;
  });
  data.categories = data.categories.filter(({ id }) => id !== categoryId);
  data.categories.forEach((item, position) => (item.position = position));
  return true;
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
