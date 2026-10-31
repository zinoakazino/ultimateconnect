import { fetchNotifications } from '../lib/api';
import { useLive } from '../lib/live';
import type { NotificationDoc } from '../types/models';

const EMPTY: NotificationDoc[] = [];

export function useNotifications(userId: string | undefined) {
  const { data, loading } = useLive<NotificationDoc[]>(
    () => fetchNotifications(userId as string),
    EMPTY,
    [userId],
    { enabled: Boolean(userId), tables: [{ table: 'notifications', filter: `user_id=eq.${userId}` }], poll: 15000 }
  );
  return { notifications: data, loading, unreadCount: data.filter((n) => !n.read).length };
}
