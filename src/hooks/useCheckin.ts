import { fetchCheckinResponses, fetchLatestCheckin, hasAnsweredCheckin } from '../lib/api';
import { useLive } from '../lib/live';
import type { CheckinDoc, CheckinResponseDoc } from '../types/models';

export { answerCheckin, closeCheckin, openCheckin } from '../lib/api';

const NO_RESPONSES: CheckinResponseDoc[] = [];

/** The most recent roll-call (open or closed), or null. */
export function useLatestCheckin() {
  return useLive<CheckinDoc | null>(fetchLatestCheckin, null, [], { tables: ['checkins'], poll: 10000 }).data;
}

/** Has this consultant already answered the given roll-call? */
export function useMyCheckinResponse(checkinId: string | undefined, uid: string | undefined) {
  return useLive<boolean>(() => hasAnsweredCheckin(checkinId as string, uid as string), false, [checkinId, uid], {
    enabled: Boolean(checkinId && uid),
    tables: ['checkin_responses'],
    poll: 10000,
  }).data;
}

/** Staff only: everyone who has answered the given roll-call. */
export function useCheckinResponses(checkinId: string | undefined) {
  return useLive<CheckinResponseDoc[]>(() => fetchCheckinResponses(checkinId as string), NO_RESPONSES, [checkinId], {
    enabled: Boolean(checkinId),
    tables: ['checkin_responses'],
    poll: 8000,
  }).data;
}
