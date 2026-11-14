import type { ScopeRow } from '@/app/features/scope';
import { useChat } from '@/app/hooks';
import {
  clearChat,
  postChatMessage,
  postChatMessageAt,
  postChatPermission,
  postChatRetry,
  postChatRetryAt,
} from '@/app/services/content';
import { refreshChat } from '@/app/services/query-client';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { ChatPermissionAsk, ChatPermissionChoice, ThreadMessage } from '@/types/index';
import { useToast } from '@dendelion/folk-ui';
import { useState } from 'react';
import { nowMinuteString } from '../helpers';

type Toast = ReturnType<typeof useToast>['toast'];

async function postAndReload(
  post: () => Promise<void>,
  loadChat: () => Promise<void>,
  toast: Toast,
  onThrowFailure?: () => void,
  onPosted?: () => void,
): Promise<boolean> {
  try {
    await post();
    // Clears the optimistic bubble before the reload lands, so the fetched
    // thread never renders the same message alongside it.
    onPosted?.();
    await loadChat();
    return true;
  } catch (err) {
    toast({
      title: 'Message failed to send',
      description: oneLineErrorSummary((err as Error).message),
      variant: 'error',
    });
    onThrowFailure?.();
    return false;
  }
}

export async function sendChatText(
  text: string,
  { restoreOnFailure }: { restoreOnFailure: boolean },
  deps: {
    postChatMessage: (text: string) => Promise<void>;
    loadChat: () => Promise<void>;
    toast: Toast;
    setInput: (updater: (current: string) => string) => void;
    onPosted?: () => void;
  },
): Promise<boolean> {
  return postAndReload(
    () => deps.postChatMessage(text),
    deps.loadChat,
    deps.toast,
    () => {
      if (restoreOnFailure) deps.setInput((current) => current || text);
    },
    deps.onPosted,
  );
}

export async function retryChatReply(deps: {
  postChatRetry: () => Promise<void>;
  loadChat: () => Promise<void>;
  toast: Toast;
}): Promise<boolean> {
  return postAndReload(deps.postChatRetry, deps.loadChat, deps.toast);
}

export async function answerChatPermission(
  choice: ChatPermissionChoice,
  ask: ChatPermissionAsk,
  deps: {
    postChatPermission: (choice: ChatPermissionChoice, ask: ChatPermissionAsk) => Promise<void>;
    loadChat: () => Promise<void>;
    toast: Toast;
  },
): Promise<boolean> {
  return postAndReload(() => deps.postChatPermission(choice, ask), deps.loadChat, deps.toast);
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

  const loadChatFor = (
    target?: ScopeRow,
    refetchForeign?: (runtimeUrl: string) => Promise<void>,
  ) =>
    target && !target.isCurrent
      ? async () => {
          if (refetchForeign) await refetchForeign(target.runtimeUrl);
        }
      : refreshChat;

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
        loadChat: loadChatFor(target, refetchForeign),
        toast,
        setInput,
        onPosted: () => setPending(null),
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

  const handleRetry = async (
    target?: ScopeRow,
    refetchForeign?: (runtimeUrl: string) => Promise<void>,
  ) => {
    setSending(true);
    try {
      const toForeign = target && !target.isCurrent;
      await retryChatReply({
        postChatRetry: toForeign ? () => postChatRetryAt(target.runtimeUrl) : postChatRetry,
        loadChat: loadChatFor(target, refetchForeign),
        toast,
      });
    } finally {
      setSending(false);
    }
  };

  const handlePermission = async (choice: ChatPermissionChoice, ask: ChatPermissionAsk) => {
    setSending(true);
    try {
      return await answerChatPermission(choice, ask, {
        postChatPermission,
        loadChat: refreshChat,
        toast,
      });
    } finally {
      setSending(false);
    }
  };

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
    handleRetry,
    handlePermission,
    confirmOpen,
    openConfirmClear,
    closeConfirmClear,
    handleClear,
    clearing,
  };
}
