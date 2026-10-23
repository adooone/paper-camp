import type { ScopeRow } from '@/app/features/scope';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { fetchRunsAt } from '@/app/services/agent-api';
import { fetchTaskLogAt } from '@/app/services/content/docs-api';
import {
  fetchNotificationsAt,
  markNotificationReadAt,
} from '@/app/services/content/notifications-api';
import { buildLogRows } from '@/core/run-rows';
import type { LogRow } from '@/types/index';
import { useEffect, useState } from 'react';

interface ScopeActivityData {
  project: ScopeRow;
  rows: LogRow[];
}

/** Fetches every other scope project's runs, task log and notifications for
 * the Activity page's merged stream (IDEA-291) — the same inputs
 * `useLogRows` reads for the current project, built into `LogRow`s with that
 * project's own unread state. Desk/CI-derived issues stay the current
 * project's, so foreign rows carry no `issues`. */
export const useScopeActivity = (otherProjects: ScopeRow[]) => {
  const [data, setData] = useState<Record<string, LogRow[]>>({});
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
          const [agentStatus, taskLog, notifications] = await Promise.all([
            fetchRunsAt(runtimeUrl),
            fetchTaskLogAt(runtimeUrl),
            fetchNotificationsAt(runtimeUrl),
          ]);
          const rows = buildLogRows(taskLog ?? [], [], agentStatus ?? [], notifications ?? []);
          return [runtimeUrl, rows] as const;
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
    rows: data[project.runtimeUrl] ?? [],
  }));

  const refetch = async (runtimeUrl: string) => {
    const [agentStatus, taskLog, notifications] = await Promise.all([
      fetchRunsAt(runtimeUrl),
      fetchTaskLogAt(runtimeUrl),
      fetchNotificationsAt(runtimeUrl),
    ]);
    const rows = buildLogRows(taskLog ?? [], [], agentStatus ?? [], notifications ?? []);
    setData((current) => ({ ...current, [runtimeUrl]: rows }));
  };

  const markRead = async (project: ScopeRow, id: string) => {
    await markNotificationReadAt(project.runtimeUrl, id);
    await refetch(project.runtimeUrl);
  };

  return { data: scoped, refetch, markRead };
};
