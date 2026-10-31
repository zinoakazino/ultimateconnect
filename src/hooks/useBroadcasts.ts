import { fetchRecentBroadcasts } from '../lib/api';
import { useLive } from '../lib/live';
import type { BroadcastDoc } from '../types/models';

export { readReceipts } from '../lib/api';

const EMPTY: BroadcastDoc[] = [];

/** Staff only: the latest announcements they sent. */
export function useRecentBroadcasts(count = 5) {
  return useLive<BroadcastDoc[]>(() => fetchRecentBroadcasts(count), EMPTY, [count], {
    tables: ['broadcasts', 'notifications'],
    poll: 20000,
  }).data;
}
