import { apiFetch, apiUrl } from '@/app/services/api-base';
import type {
  ChatPermissionAsk,
  ChatPermissionChoice,
  MountContext,
  ThreadMessage,
} from '@/types/index';

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

async function expectOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error ?? fallback);
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const postChatMessage = async (text: string, context?: MountContext): Promise<void> =>
  expectOk(
    await apiFetch(apiUrl('/api/chat'), jsonPost({ text, ...(context && { context }) })),
    'Failed to send message',
  );

export const postChatMessageAt = async (baseUrl: string, text: string): Promise<void> =>
  expectOk(await fetch(`${baseUrl}/api/chat`, jsonPost({ text })), 'Failed to send message');

export const postChatRetry = async (): Promise<void> =>
  expectOk(
    await apiFetch(apiUrl('/api/chat/retry'), { method: 'POST' }),
    'Failed to retry message',
  );

export const postChatRetryAt = async (baseUrl: string): Promise<void> =>
  expectOk(await fetch(`${baseUrl}/api/chat/retry`, { method: 'POST' }), 'Failed to retry message');

export const postChatPermission = async (
  choice: ChatPermissionChoice,
  ask: ChatPermissionAsk,
): Promise<void> =>
  expectOk(
    await apiFetch(apiUrl('/api/chat/allow'), jsonPost({ ...ask, choice })),
    'Failed to answer the permission question',
  );

export const clearChat = async (): Promise<void> => {
  const res = await apiFetch(apiUrl('/api/chat'), { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to clear chat: ${res.status}`);
};
