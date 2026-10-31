import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useDmThreads } from '../hooks/useDmThreads';
import { useNotifications } from '../hooks/useNotifications';
import { fetchLatestGroupMessage } from '../lib/api';
import { useLive } from '../lib/live';
import { toDate } from '../lib/dates';
import type { MessageDoc } from '../types/models';

interface UnreadValue {
  groupUnread: boolean;
  /** Threads whose latest message is from the other person and not yet opened. */
  unreadThreadIds: string[];
  /** Unread entries in the consultant's notification feed. */
  notificationsUnread: number;
  /** Mark the group chat read up to `latestMs` (or now). */
  markGroupRead: (latestMs?: number) => void;
  markThreadRead: (threadId: string, latestMs?: number) => void;
}

const UnreadContext = createContext<UnreadValue | undefined>(undefined);

type LastRead = Record<string, number>;

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { authUser, profile } = useAuth();
  const uid = authUser?.uid;
  const isMember = Boolean(profile);
  const storageKey = uid ? `uc_lastread_${uid}` : null;

  const [lastRead, setLastRead] = useState<LastRead>({});
  const [loaded, setLoaded] = useState(false);
  // Mirrors `lastRead` so `mark` can stay a stable function (screens list it in effect deps).
  const lastReadRef = useRef<LastRead>({});

  // Persisted "last opened" times, so badges survive an app restart.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    lastReadRef.current = {};
    setLastRead({});
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled || !raw) return;
        const saved = JSON.parse(raw) as LastRead;
        lastReadRef.current = saved;
        setLastRead(saved);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Only the single newest group message is needed to know if something is unread.
  const { data: latestGroup } = useLive<MessageDoc | null>(fetchLatestGroupMessage, null, [uid], {
    enabled: isMember,
    tables: ['messages'],
    poll: 8000,
  });

  const threads = useDmThreads(isMember ? uid : undefined);
  const { unreadCount } = useNotifications(profile?.role === 'consultant' ? uid : undefined);

  // Marks `key` read up to `latestMs` — the newest message's own timestamp, not the device
  // clock, because it is compared with server timestamps. Marking the same message again is
  // a no-op: it must not produce new state, or the screens that call this on every change
  // would re-render in a loop. Held back until the saved times have been loaded; the
  // callback's identity changes then, so screens re-run their effect and mark for real.
  const mark = useCallback(
    (key: string, latestMs?: number) => {
      if (!loaded || !storageKey) return;
      const prev = lastReadRef.current;
      const at = latestMs ?? prev[key] ?? Date.now();
      if (prev[key] !== undefined && prev[key] >= at) return;
      const next = { ...prev, [key]: at };
      lastReadRef.current = next;
      setLastRead(next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
    },
    [loaded, storageKey]
  );

  const markGroupRead = useCallback((latestMs?: number) => mark('group', latestMs), [mark]);
  const markThreadRead = useCallback(
    (threadId: string, latestMs?: number) => mark(threadId, latestMs),
    [mark]
  );

  const groupUnread = useMemo(() => {
    if (!loaded || !latestGroup || latestGroup.senderId === uid) return false;
    const ms = toDate(latestGroup.createdAt)?.getTime();
    return ms !== undefined && ms > (lastRead.group ?? 0);
  }, [loaded, latestGroup, lastRead.group, uid]);

  const unreadThreadIds = useMemo(() => {
    if (!loaded) return [];
    return threads
      .filter((t) => {
        if (t.lastSenderId === uid) return false;
        const ms = toDate(t.lastMessageAt)?.getTime();
        return ms !== undefined && ms > (lastRead[t.id] ?? 0);
      })
      .map((t) => t.id);
  }, [loaded, threads, lastRead, uid]);

  const value = useMemo<UnreadValue>(
    () => ({
      groupUnread,
      unreadThreadIds,
      notificationsUnread: unreadCount,
      markGroupRead,
      markThreadRead,
    }),
    [groupUnread, unreadThreadIds, unreadCount, markGroupRead, markThreadRead]
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error('useUnread must be used within UnreadProvider');
  return ctx;
}
