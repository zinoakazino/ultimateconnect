import { fetchDmMessages, fetchGroupMessages } from '../lib/api';
import { useLive } from '../lib/live';
import type { MessageDoc } from '../types/models';

const EMPTY: MessageDoc[] = [];

/** Which conversation to show: the whole group, or one private thread. */
export type MessageSource = { kind: 'group' } | { kind: 'dm'; threadId: string };

export const GROUP_MESSAGES: MessageSource = { kind: 'group' };
export const dmMessages = (threadId: string): MessageSource => ({ kind: 'dm', threadId });

/** Live messages for a conversation, newest first (what an inverted FlatList wants). */
export function useMessages(source: MessageSource | null) {
  const key = source ? (source.kind === 'group' ? 'group' : `dm:${source.threadId}`) : '';
  const { data, loading } = useLive<MessageDoc[]>(
    () => (source?.kind === 'dm' ? fetchDmMessages(source.threadId) : fetchGroupMessages()),
    EMPTY,
    [key],
    {
      enabled: Boolean(source),
      tables: [source?.kind === 'dm' ? 'dm_messages' : 'messages'],
      poll: 4000,
    }
  );
  return { messages: data, loading };
}
