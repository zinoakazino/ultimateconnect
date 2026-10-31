import { fetchTrip } from '../lib/api';
import { useLive } from '../lib/live';
import type { TripDoc } from '../types/models';

export function useTrip() {
  const { data, loading } = useLive<TripDoc | null>(fetchTrip, null, [], { tables: ['trip'], poll: 60000 });
  return { trip: data, loading };
}
