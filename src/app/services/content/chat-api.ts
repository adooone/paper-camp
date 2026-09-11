import { apiFetch, apiUrl } from '@/app/services/api-base';
import type { ThreadMessage } from '@/types/index';

export const fetchChat = async (): Promise<ThreadMessage[]> => {
  const res = await apiFetch(apiUrl('/api/chat'));
  if (!res.ok) throw new Error(`Failed to fetch chat: ${res.status}`);
  const data = await res.json();
  return data.thread as ThreadMessage[];
};

export const postChatMessage = async (text: string): Promise<{ error?: string }> => {
  const res = await apiFetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to send message');
  return data as { error?: string };
};

export const clearChat = async (): Promise<void> => {
  const res = await apiFetch(apiUrl('/api/chat'), { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to clear chat: ${res.status}`);
};
