import { clearChat, postChatMessage } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const isUnansweredQuestion = (m: { kind: string; state?: string }) =>
  m.kind === 'question' && (m.state ?? 'open') === 'open';

export function useChatPage() {
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

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setPending(text);
    setInput('');
    try {
      const { error } = await postChatMessage(text);
      await loadChat();
      if (error) {
        toast({
          title: 'Agent did not reply',
          description: oneLineErrorSummary(error),
          variant: 'error',
        });
      }
    } catch (err) {
      toast({
        title: 'Message failed to send',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
      setInput((current) => current || text);
    } finally {
      setPending(null);
      setSending(false);
    }
  };

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
    unansweredCount: thread.filter(isUnansweredQuestion).length,
    confirmOpen,
    openConfirmClear,
    closeConfirmClear,
    handleClear,
    clearing,
  };
}
