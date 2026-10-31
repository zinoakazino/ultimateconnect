import { useAuth } from '../context/AuthContext';
import { todayKey } from '../lib/dates';
import { itemsForGroup } from '../lib/groups';
import { compareScheduleItems, useSchedule } from './useSchedule';

/** Today's programme for the signed-in person: the lines for everybody plus those for their own travel group. */
export function useTodaySchedule() {
  const { profile } = useAuth();
  const key = todayKey();
  const { items, loading } = useSchedule(key);

  const sorted = itemsForGroup(items, profile?.groupId ?? null).sort(compareScheduleItems);
  const pinned = sorted.find((item) => item.important) ?? null;

  return { items: sorted, pinned, loading };
}
