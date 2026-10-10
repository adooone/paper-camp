import type { ScopeRow } from '@/app/features/scope';
import { clearChat, postChatMessage, postChatMessageAt } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const isUnansweredQuestion = (m: { kind: string; state?: string }) =>
  m.kind === 'question' && (m.state ?? 'open') === 'open';

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

export function useChatThread() {
  const thread = useAppStore((s) => s.chatThread) ?? [];
  const loading = useAppStore((s) => s.chatLoading);
  const loadChat = useAppStore((s) => s.loadChat);
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  const sendText = async (text: string, opts: { restoreOnFailure: boolean }, target?: ScopeRow) => {
    setSending(true);
    setPending(text);
    try {
      const toForeign = target && !target.isCurrent;
      return await sendChatText(text, opts, {
        postChatMessage: toForeign
          ? (t) => postChatMessageAt(target.runtimeUrl, t)
          : postChatMessage,
        loadChat: toForeign ? async () => {} : loadChat,
        toast,
        setInput,
      });
    } finally {
      setPending(null);
      setSending(false);
    }
  };

  const handleSend = async (target?: ScopeRow) => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    return await sendText(text, { restoreOnFailure: true }, target);
  };

  // A picked option answers exactly like a typed message, but never touches the
  // composer's draft — it isn't that draft.
  const handleAnswer = async (text: string, target?: ScopeRow) =>
    sendText(text, { restoreOnFailure: false }, target);

  const openConfirmClear = () => setConfirmOpen(true);
  const closeConfirmClear = () => setConfirmOpen(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearChat();
      await loadChat();
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
    unansweredCount: thread.filter(isUnansweredQuestion).length,
    confirmOpen,
    openConfirmClear,
    closeConfirmClear,
    handleClear,
    clearing,
  };
}
