import type { ScopeRow } from '@/app/features/scope';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { fetchRunsAt } from '@/app/services/agent-api';
import { fetchTaskLogAt } from '@/app/services/content/docs-api';
import {
  fetchNotificationsAt,
  markNotificationReadAt,
} from '@/app/services/content/notifications-api';
import type { AgentTaskState, Notification, TaskLogEntry } from '@/types/index';
import { useEffect, useState } from 'react';

interface ScopeRunData {
  project: ScopeRow;
  agentStatus: AgentTaskState[];
  taskLog: TaskLogEntry[];
  notifications: Notification[];
}

interface ProjectData {
  agentStatus: AgentTaskState[];
  taskLog: TaskLogEntry[];
  notifications: Notification[];
}

export interface UseScopeRunsResult {
  runs: ScopeRunData[];
  markRead: (project: ScopeRow, id: string) => Promise<void>;
}

const loadProject = async (runtimeUrl: string): Promise<ProjectData> => {
  const [agentStatus, taskLog, notifications] = await Promise.all([
    fetchRunsAt(runtimeUrl),
    fetchTaskLogAt(runtimeUrl),
    fetchNotificationsAt(runtimeUrl),
  ]);
  return {
    agentStatus: agentStatus ?? [],
    taskLog: taskLog ?? [],
    notifications: notifications ?? [],
  };
};

/** Fetches every other scope project's running tasks, task log and notifications
 * for the Stack's agent section (IDEA-291), kept live by the per-runtime activity
 * stream opened in services/activity-stream.ts. No server merges this — the
 * browser fans out to each project's runtime and joins the results here. */
export const useScopeRuns = (otherProjects: ScopeRow[]): UseScopeRunsResult => {
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
        urls.map(async (runtimeUrl) => [runtimeUrl, await loadProject(runtimeUrl)] as const),
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

  const markRead = async (project: ScopeRow, id: string) => {
    await markNotificationReadAt(project.runtimeUrl, id);
    const projectData = await loadProject(project.runtimeUrl);
    setData((current) => ({ ...current, [project.runtimeUrl]: projectData }));
  };

  return {
    runs: otherProjects.map((project) => ({
      project,
      agentStatus: data[project.runtimeUrl]?.agentStatus ?? [],
      taskLog: data[project.runtimeUrl]?.taskLog ?? [],
      notifications: data[project.runtimeUrl]?.notifications ?? [],
    })),
    markRead,
  };
};
