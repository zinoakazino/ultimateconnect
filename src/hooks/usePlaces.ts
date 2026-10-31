import { fetchPlaces } from '../lib/api';
import { useLive } from '../lib/live';
import type { PlaceDoc } from '../types/models';

const EMPTY: PlaceDoc[] = [];

export function usePlaces() {
  const { data, loading } = useLive<PlaceDoc[]>(fetchPlaces, EMPTY, [], { tables: ['places'], poll: 60000 });
  return { places: data, loading };
}
