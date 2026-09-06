export interface TripPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
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
  categories: string[];
}

export interface PointDraft {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  pendingImportId?: string;
}
