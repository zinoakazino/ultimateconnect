import { fetchRoster } from '../lib/api';
import { useLive } from '../lib/live';
import type { RosterEntry } from '../types/models';

const NONE: RosterEntry[] = [];

/** The participants staff prepared in advance and who has signed up (staff only: `enabled` for screens shared with others). */
export function useRoster(enabled = true) {
  const { data, loading } = useLive<RosterEntry[]>(fetchRoster, NONE, [], { enabled, tables: ['roster'], poll: 15000 });
  return { roster: data, loading };
}
