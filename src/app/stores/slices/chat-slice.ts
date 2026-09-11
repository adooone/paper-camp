import { fetchChat } from '@/app/services/content';
import type { ThreadMessage } from '@/types/index';
import type { SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type ChatSlice = {
  chatThread: ThreadMessage[] | null;
  chatLoading: boolean;
  chatError: string | null;
  loadChat: () => Promise<void>;
};

export function createChatSlice(set: SetState): ChatSlice {
  return {
    chatThread: null,
    chatLoading: false,
    chatError: null,
    loadChat: loadSlice(
      set,
      fetchChat,
      (thread) => ({ chatThread: thread, chatError: null }),
      (err) => ({ chatError: String(err) }),
      'chatLoading',
    ),
  };
}
