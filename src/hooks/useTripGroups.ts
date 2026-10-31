import { useAuth } from '../context/AuthContext';
import { fetchTripGroups } from '../lib/api';
import { useLive } from '../lib/live';
import type { TripGroupDoc } from '../types/models';

const NONE: TripGroupDoc[] = [];

/** Both travel groups with their flights (any signed-in member can read them). */
export function useTripGroups() {
  const { data, loading } = useLive<TripGroupDoc[]>(fetchTripGroups, NONE, [], { tables: ['trip_groups'], poll: 60000 });
  return { groups: data, loading };
}

/** The signed-in person's own group, or null when staff have not set it. */
export function useMyGroup() {
  const { profile } = useAuth();
  const { groups, loading } = useTripGroups();
  const mine = profile?.groupId != null ? groups.find((g) => g.id === profile.groupId) ?? null : null;
  return { group: mine, groups, loading };
}
