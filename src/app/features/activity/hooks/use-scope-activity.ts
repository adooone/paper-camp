import type { ScopeRow } from '@/app/features/scope';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { fetchRunsAt } from '@/app/services/agent-api';
import { fetchChatAt } from '@/app/services/content/chat-api';
import { fetchTaskLogAt } from '@/app/services/content/docs-api';
import {
  fetchNotificationsAt,
  markNotificationReadAt,
} from '@/app/services/content/notifications-api';
import { buildLogRows } from '@/core/run-rows';
import type { LogRow, ThreadMessage } from '@/types/index';
import { useEffect, useState } from 'react';

export interface ScopeActivityData {
  project: ScopeRow;
  rows: LogRow[];
  chat: ThreadMessage[];
}

interface ProjectData {
  rows: LogRow[];
  chat: ThreadMessage[];
}

/** Fetches every other scope project's runs, task log, notifications and chat
 * for the Activity page's merged stream (IDEA-291) — the same inputs
 * `useLogRows`/`useChatThread` read for the current project, built into
 * `LogRow`s with that project's own unread state. Desk/CI-derived issues stay
 * the current project's, so foreign rows carry no `issues`. */
export const useScopeActivity = (otherProjects: ScopeRow[]) => {
  const [data, setData] = useState<Record<string, ProjectData>>({});
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
        urls.map(async (runtimeUrl) => {
          const [agentStatus, taskLog, notifications, chat] = await Promise.all([
            fetchRunsAt(runtimeUrl),
            fetchTaskLogAt(runtimeUrl),
            fetchNotificationsAt(runtimeUrl),
            fetchChatAt(runtimeUrl),
          ]);
          const rows = buildLogRows(taskLog ?? [], [], agentStatus ?? [], notifications ?? []);
          return [runtimeUrl, { rows, chat: chat ?? [] }] as const;
        }),
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

  const scoped: ScopeActivityData[] = otherProjects.map((project) => ({
    project,
    rows: data[project.runtimeUrl]?.rows ?? [],
    chat: data[project.runtimeUrl]?.chat ?? [],
  }));

  const refetch = async (runtimeUrl: string) => {
    const [agentStatus, taskLog, notifications, chat] = await Promise.all([
      fetchRunsAt(runtimeUrl),
      fetchTaskLogAt(runtimeUrl),
      fetchNotificationsAt(runtimeUrl),
      fetchChatAt(runtimeUrl),
    ]);
    const rows = buildLogRows(taskLog ?? [], [], agentStatus ?? [], notifications ?? []);
    setData((current) => ({ ...current, [runtimeUrl]: { rows, chat: chat ?? [] } }));
  };

  const markRead = async (project: ScopeRow, id: string) => {
    await markNotificationReadAt(project.runtimeUrl, id);
    await refetch(project.runtimeUrl);
  };

  return { data: scoped, refetch, markRead };
};
