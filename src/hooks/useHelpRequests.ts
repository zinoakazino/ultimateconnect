import { fetchOpenHelpRequests } from '../lib/api';
import { useLive } from '../lib/live';
import type { HelpRequestDoc } from '../types/models';

export { createHelpRequest, resolveHelpRequest } from '../lib/api';

const EMPTY: HelpRequestDoc[] = [];

/** Staff only: open "I need help" requests, most recent first. */
export function useOpenHelpRequests(enabled: boolean) {
  return useLive<HelpRequestDoc[]>(fetchOpenHelpRequests, EMPTY, [], {
    enabled,
    tables: ['help_requests'],
    poll: 6000,
  }).data;
}
