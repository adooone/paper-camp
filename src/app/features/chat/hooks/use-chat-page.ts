import { type ScopeRow, useScope } from '@/app/features/scope';
import { useMemo, useState } from 'react';
import { mergeScopedChatMessages } from '../helpers';
import { useChatThread } from './use-chat-thread';
import { useScopeChat } from './use-scope-chat';

export function useChatPage() {
  const chat = useChatThread();
  const scope = useScope('chat');

  const allScopeRows = useMemo(() => scope.groups.flatMap((g) => g.rows), [scope.groups]);
  const currentScopeRow = allScopeRows.find((r) => r.isCurrent);
  const checkedScopeRows = allScopeRows.filter((r) => r.checked);
  const multiProject = checkedScopeRows.length > 1;
  const otherScopeRows = multiProject ? checkedScopeRows.filter((r) => !r.isCurrent) : [];
  const scopeChat = useScopeChat(otherScopeRows);

  const [targetProjectKey, setTargetProjectKey] = useState<string | null>(null);
  const targetProject =
    (targetProjectKey && checkedScopeRows.find((r) => r.key === targetProjectKey)) ||
    currentScopeRow;

  const messages = useMemo(
    () =>
      mergeScopedChatMessages(
        chat.thread,
        scopeChat.data,
        multiProject ? currentScopeRow : undefined,
      ),
    [chat.thread, scopeChat.data, multiProject, currentScopeRow],
  );

  const handleSend = async () => {
    const sentToForeign = Boolean(targetProject && !targetProject.isCurrent);
    const ok = await chat.handleSend(targetProject);
    if (ok && sentToForeign && targetProject) await scopeChat.refetch(targetProject.runtimeUrl);
  };

  const handleAnswer = async (text: string, project?: ScopeRow) => {
    const ok = await chat.handleAnswer(text, project);
    if (ok && project && !project.isCurrent) await scopeChat.refetch(project.runtimeUrl);
    return ok;
  };

  return {
    loading: chat.loading,
    messages,
    pending: chat.pending,
    sending: chat.sending,
    input: chat.input,
    setInput: chat.setInput,
    handleSend,
    handleAnswer,
    confirmOpen: chat.confirmOpen,
    openConfirmClear: chat.openConfirmClear,
    closeConfirmClear: chat.closeConfirmClear,
    handleClear: chat.handleClear,
    clearing: chat.clearing,
    projectOptions: checkedScopeRows,
    targetProject,
    setTargetProjectKey,
    currentScopeRow,
  };
}
