import { withIdeaPrefix } from '@/app/features/chat/helpers';
import { type ChatTurnInfo, useChatStage } from '@/app/features/chat/hooks/use-chat-stage';
import { type ActivityMessage, subscribeToActivityStream } from '@/app/services/activity-stream';
import { fetchChat, postChatMessage } from '@/app/services/content/chat-api';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { MountContext, ThreadMessage } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';

export function mountContextFor(
  location: { pathname: string },
  viewport: { innerWidth: number; innerHeight: number },
  focusedIdeaId?: string,
): MountContext {
  return {
    route: location.pathname,
    ...(focusedIdeaId && { focusedIdeaId }),
    viewport: { width: viewport.innerWidth, height: viewport.innerHeight },
  };
}

export function isChatChange(payload: ActivityMessage): boolean {
  if (payload.message === 'changed') return !payload.area || payload.area === 'chat';
  return payload.type === 'chat' && (payload.stage === 'done' || payload.stage === 'failed');
}

export async function sendClientChat(
  text: string,
  context: MountContext,
  deps: {
    post: (text: string, context: MountContext) => Promise<void>;
    load: () => Promise<void>;
  },
): Promise<string | null> {
  try {
    await deps.post(text, context);
    await deps.load();
    return null;
  } catch (err) {
    return oneLineErrorSummary((err as Error).message);
  }
}

interface ChatClientState {
  thread: ThreadMessage[];
  turn: ChatTurnInfo | null;
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  error: string | null;
  send: () => Promise<void>;
  prefill: (ideaId: string) => void;
}

export function useChatClient(focusedIdeaId?: string): ChatClientState {
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { turn } = useChatStage(thread.length);

  const load = useCallback(async () => {
    try {
      setThread(await fetchChat());
    } catch {}
  }, []);

  useEffect(() => {
    void load();
    return subscribeToActivityStream((payload) => {
      if (isChatChange(payload)) void load();
    });
  }, [load]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setInput('');
    const failure = await sendClientChat(
      text,
      mountContextFor(window.location, window, focusedIdeaId),
      { post: postChatMessage, load },
    );
    if (failure) {
      setError(failure);
      setInput((current) => current || text);
    }
    setSending(false);
  };

  const prefill = (ideaId: string) => setInput((current) => withIdeaPrefix(current, ideaId));

  return { thread, turn, input, setInput, sending, error, send, prefill };
}
