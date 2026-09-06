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
}

export interface PointDraft {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categoryId?: string;
  pendingImportId?: string;
}
