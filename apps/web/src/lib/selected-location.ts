export interface SelectedLocationState {
  id: string | null;
  source: 'search' | 'itinerary' | 'marker' | 'social' | 'route' | null;
}

export function selectLocation(
  _current: SelectedLocationState,
  id: string,
  source: NonNullable<SelectedLocationState['source']>,
): SelectedLocationState {
  return { id, source };
}
