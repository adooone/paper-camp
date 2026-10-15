import { fetchChat } from '@/app/services/content';
import { chatQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import type { ThreadMessage } from '@/types/index';
import { useQuery } from '@tanstack/react-query';

export interface UseChatResult {
  chatThread: ThreadMessage[] | null;
  chatLoading: boolean;
  chatError: string | null;
}

export function useChat(): UseChatResult {
  const { runtimeUrl } = useRuntimeConnection();
  const { data, isLoading, error } = useQuery({
    queryKey: chatQueryKey(runtimeUrl),
    queryFn: fetchChat,
  });
  return {
    chatThread: data ?? null,
    chatLoading: isLoading,
    chatError: error ? String(error) : null,
  };
}

export function useUnansweredChatQuestionCount(): number {
  return (
    useChat().chatThread?.filter((m) => m.kind === 'question' && (m.state ?? 'open') === 'open')
      .length ?? 0
  );
}
