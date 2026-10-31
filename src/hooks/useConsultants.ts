import { fetchConsultants } from '../lib/api';
import { useLive } from '../lib/live';
import type { UserDoc } from '../types/models';

const EMPTY: UserDoc[] = [];

/** `enabled` lets screens shared with consultants skip the (staff-only) query. */
export function useConsultants(enabled = true) {
  const { data, loading } = useLive<UserDoc[]>(fetchConsultants, EMPTY, [], {
    enabled,
    tables: ['profiles'],
    poll: 15000,
  });
  return { consultants: data, loading };
}
