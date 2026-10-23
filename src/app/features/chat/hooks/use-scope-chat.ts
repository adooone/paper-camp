import type { ScopeRow } from '@/app/features/scope';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { fetchChatAt } from '@/app/services/content/chat-api';
import type { ThreadMessage } from '@/types/index';
import { useEffect, useState } from 'react';

interface ScopeChatData {
  project: ScopeRow;
  messages: ThreadMessage[];
}

/** Fetches every other scope project's chat for the Chat page's merged thread
 * (IDEA-293) — the same input `useChatThread` reads for the current project. */
export const useScopeChat = (otherProjects: ScopeRow[]) => {
  const [data, setData] = useState<Record<string, ThreadMessage[]>>({});
  const key = otherProjects.map((p) => p.runtimeUrl).join('\n');

  useEffect(() => {
    const urls = key === '' ? [] : key.split('\n');
    if (urls.length === 0) {
      setData({});
      return;
    }
    let cancelled = false;
    const load = () => {
      Promise.all(
        urls.map(
          async (runtimeUrl) => [runtimeUrl, (await fetchChatAt(runtimeUrl)) ?? []] as const,
        ),
      ).then((entries) => {
        if (!cancelled) setData(Object.fromEntries(entries));
      });
    };
    load();
    const unsubscribes = urls.map((runtimeUrl) => subscribeToActivityStream(load, runtimeUrl));
    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [key]);

  const scoped: ScopeChatData[] = otherProjects.map((project) => ({
    project,
    messages: data[project.runtimeUrl] ?? [],
  }));

  const refetch = async (runtimeUrl: string) => {
    const messages = (await fetchChatAt(runtimeUrl)) ?? [];
    setData((current) => ({ ...current, [runtimeUrl]: messages }));
  };

  return { data: scoped, refetch };
};
