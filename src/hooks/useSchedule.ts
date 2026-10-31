import { fetchAllSchedule, fetchSchedule, publishSchedule } from '../lib/api';
import { useLive } from '../lib/live';
import type { ScheduleDoc, ScheduleItem } from '../types/models';

const EMPTY: ScheduleItem[] = [];

export function useSchedule(dateKey: string) {
  const { data, loading } = useLive<ScheduleItem[]>(() => fetchSchedule(dateKey), EMPTY, [dateKey], {
    tables: ['schedule'],
    poll: 30000,
  });

  const publish = (nextItems: ScheduleItem[]) => publishSchedule(dateKey, nextItems);

  return { items: data, loading, publish };
}

const NO_DAYS: ScheduleDoc[] = [];

/** The whole programme: every published day. */
export function useFullSchedule() {
  const { data, loading } = useLive<ScheduleDoc[]>(fetchAllSchedule, NO_DAYS, [], { tables: ['schedule'], poll: 30000 });
  return { days: data, loading };
}

export function newScheduleItemId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Items without a clock time ("—") come first, then by time. */
export function compareScheduleItems(a: ScheduleItem, b: ScheduleItem) {
  return a.time.localeCompare(b.time);
}
