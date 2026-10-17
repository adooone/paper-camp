import type { ScopeRow } from '@/app/features/scope';
import { useChat } from '@/app/hooks';
import { clearChat, postChatMessage, postChatMessageAt } from '@/app/services/content';
import { refreshChat } from '@/app/services/query-client';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { ThreadMessage } from '@/types/index';
import { useToast } from '@dendelion/folk-ui';
import { useState } from 'react';
import { nowMinuteString } from '../helpers';

export async function sendChatText(
  text: string,
  { restoreOnFailure }: { restoreOnFailure: boolean },
  deps: {
    postChatMessage: (text: string) => Promise<{ error?: string }>;
    loadChat: () => Promise<void>;
    toast: ReturnType<typeof useToast>['toast'];
    setInput: (updater: (current: string) => string) => void;
  },
): Promise<boolean> {
  try {
    const { error } = await deps.postChatMessage(text);
    await deps.loadChat();
    if (error) {
      deps.toast({
        title: 'Agent did not reply',
        description: oneLineErrorSummary(error),
        variant: 'error',
      });
      return false;
    }
    return true;
  } catch (err) {
    deps.toast({
      title: 'Message failed to send',
      description: oneLineErrorSummary((err as Error).message),
      variant: 'error',
    });
    if (restoreOnFailure) deps.setInput((current) => current || text);
    return false;
  }
}

export interface PendingChatMessage {
  message: ThreadMessage;
  project?: ScopeRow;
}

export function useChatThread() {
  const { chatThread, chatLoading } = useChat();
  const thread = chatThread ?? [];
  const loading = chatLoading;
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const sendText = async (
    text: string,
    opts: { restoreOnFailure: boolean },
    target?: ScopeRow,
    refetchForeign?: (runtimeUrl: string) => Promise<void>,
  ) => {
    setSending(true);
    setPending({
      message: { kind: 'chat', from: 'user', text, date: nowMinuteString() },
      project: target,
    });
    try {
      const toForeign = target && !target.isCurrent;
      return await sendChatText(text, opts, {
        postChatMessage: toForeign
          ? (t) => postChatMessageAt(target.runtimeUrl, t)
          : postChatMessage,
        loadChat: toForeign
          ? async () => {
              if (refetchForeign) await refetchForeign(target.runtimeUrl);
            }
          : refreshChat,
        toast,
        setInput,
      });
    } finally {
      setPending(null);
      setSending(false);
    }
  };

  const handleSend = async (
    target?: ScopeRow,
    refetchForeign?: (runtimeUrl: string) => Promise<void>,
  ) => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    return await sendText(text, { restoreOnFailure: true }, target, refetchForeign);
  };

  // A picked option answers exactly like a typed message, but never touches the
  // composer's draft — it isn't that draft.
  const handleAnswer = async (
    text: string,
    target?: ScopeRow,
    refetchForeign?: (runtimeUrl: string) => Promise<void>,
  ) => sendText(text, { restoreOnFailure: false }, target, refetchForeign);

  const openConfirmClear = () => setConfirmOpen(true);
  const closeConfirmClear = () => setConfirmOpen(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearChat();
      await refreshChat();
      setConfirmOpen(false);
    } catch (err) {
      toast({
        title: 'Clear failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setClearing(false);
    }
  };

  return {
    thread,
    loading,
    input,
    setInput,
    pending,
    sending,
    handleSend,
    handleAnswer,
    confirmOpen,
    openConfirmClear,
    closeConfirmClear,
    handleClear,
    clearing,
  };
}
