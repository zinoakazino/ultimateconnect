import { useMemo } from 'react';
import { fetchDmThreads } from '../lib/api';
import { useLive } from '../lib/live';
import { toDate } from '../lib/dates';
import type { DmThreadDoc } from '../types/models';

const EMPTY: DmThreadDoc[] = [];

/** Every 1:1 thread the user takes part in, most recent first. */
export function useDmThreads(uid: string | undefined) {
  const { data } = useLive<DmThreadDoc[]>(fetchDmThreads, EMPTY, [uid], {
    enabled: Boolean(uid),
    tables: ['dm_threads'],
    poll: 8000,
  });

  return useMemo(
    () =>
      data
        .slice()
        .sort(
          (a, b) =>
            (toDate(b.lastMessageAt)?.getTime() ?? Date.now()) -
            (toDate(a.lastMessageAt)?.getTime() ?? Date.now())
        ),
    [data]
  );
}
