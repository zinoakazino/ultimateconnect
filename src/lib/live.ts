import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

type Source = string | { table: string; filter?: string };

interface LiveOptions {
  enabled?: boolean;
  /** Tables whose changes should refresh the data (Supabase real-time). `filter` e.g. `user_id=eq.<uid>`. */
  tables?: Source[];
  /** Safety net in case real-time is unavailable: reload every `poll` ms (default 20 s). */
  poll?: number;
}

// Our own writes announce themselves here, so the screen updates at once without waiting for the
// real-time message to come back from the server.
const listeners = new Set<(table: string) => void>();
export function notifyLocalChange(...tables: string[]) {
  tables.forEach((table) => listeners.forEach((fn) => fn(table)));
}

const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

let channelSeq = 0;

/**
 * Loads data with `fetcher`, then keeps it fresh: whenever one of `tables` changes (real-time),
 * after this device's own writes, when the page becomes visible again, and every `poll` ms.
 * `deps` restart everything (e.g. another thread id): until the new data arrives, `initial` is
 * returned, never the previous thread's data. Returns the latest data and a `reload()`.
 */
export function useLive<T>(
  fetcher: () => Promise<T>,
  initial: T,
  deps: readonly unknown[],
  options: LiveOptions = {}
) {
  const { enabled = true, tables = [], poll = 20000 } = options;
  const depKey = [enabled, ...deps].map(String).join('|');
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reloadRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) {
      reloadRef.current = () => {};
      return;
    }

    let cancelled = false;
    let busy = false;
    let again = false;
    const load = async () => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      try {
        const value = await fetcherRef.current();
        if (!cancelled) setState({ key: depKey, value });
      } catch (err) {
        console.warn('[live] could not load:', (err as Error)?.message ?? err);
      } finally {
        busy = false;
        if (!cancelled) setLoadedKey(depKey);
        if (again && !cancelled) {
          again = false;
          load();
        }
      }
    };
    reloadRef.current = load;
    load();

    const watched = tables.map((s) => (typeof s === 'string' ? { table: s, filter: undefined } : s));
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (watched.length > 0) {
      channel = supabase.channel(`live-${++channelSeq}`);
      for (const { table, filter } of watched) {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
          () => load()
        );
      }
      channel.subscribe();
    }

    const onLocal = (table: string) => {
      if (watched.some((w) => w.table === table)) load();
    };
    listeners.add(onLocal);
    const timer = setInterval(() => {
      if (!isHidden()) load();
    }, poll);
    const onVisible = () => {
      if (!isHidden()) load();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      listeners.delete(onLocal);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return {
    data: enabled && state && state.key === depKey ? state.value : initial,
    loading: enabled && loadedKey !== depKey,
    reload: () => reloadRef.current(),
  };
}
