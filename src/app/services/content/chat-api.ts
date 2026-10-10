import { apiFetch, apiUrl } from '@/app/services/api-base';
import type { ThreadMessage } from '@/types/index';

export const fetchChat = async (): Promise<ThreadMessage[]> => {
  const res = await apiFetch(apiUrl('/api/chat'));
  if (!res.ok) throw new Error(`Failed to fetch chat: ${res.status}`);
  const data = await res.json();
  return data.thread as ThreadMessage[];
};

// The registry holds runtimes this client is not currently pointed at, so the base
// URL is explicit rather than taken from `apiUrl` — mirrors `fetchPackageNameAt`.
export const fetchChatAt = async (baseUrl: string): Promise<ThreadMessage[] | null> => {
  try {
    const res = await fetch(`${baseUrl}/api/chat`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thread as ThreadMessage[];
  } catch {
    return null;
  }
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
