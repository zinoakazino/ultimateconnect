import { fetchChatLock, saveChatLock } from '../lib/api';
import { useLive } from '../lib/live';

/** Staff can lock the group chat: consultants then can't send until it is unlocked. */
export function useChatLock() {
  const { data } = useLive<boolean>(fetchChatLock, false, [], { tables: ['chat_meta'], poll: 15000 });
  const setLock = (nextLocked: boolean, byUid: string) => saveChatLock(nextLocked, byUid);
  return { locked: data, setLock };
}
