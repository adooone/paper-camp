import type { ScopeRow } from '@/app/features/scope';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { fetchRunsAt } from '@/app/services/agent-api';
import { fetchTaskLogAt } from '@/app/services/content/docs-api';
import type { AgentTaskState, TaskLogEntry } from '@/types/index';
import { useEffect, useState } from 'react';

export interface ScopeRunData {
  project: ScopeRow;
  agentStatus: AgentTaskState[];
  taskLog: TaskLogEntry[];
}

interface ProjectData {
  agentStatus: AgentTaskState[];
  taskLog: TaskLogEntry[];
}

/** Fetches every other scope project's running tasks and task log for the
 * Stack's agent section (IDEA-291), kept live by the per-runtime activity
 * stream opened in services/activity-stream.ts. No server merges this — the
 * browser fans out to each project's runtime and joins the results here. */
export const useScopeRuns = (otherProjects: ScopeRow[]): ScopeRunData[] => {
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
          const [agentStatus, taskLog] = await Promise.all([
            fetchRunsAt(runtimeUrl),
            fetchTaskLogAt(runtimeUrl),
          ]);
          return [runtimeUrl, { agentStatus: agentStatus ?? [], taskLog: taskLog ?? [] }] as const;
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

  return otherProjects.map((project) => ({
    project,
    agentStatus: data[project.runtimeUrl]?.agentStatus ?? [],
    taskLog: data[project.runtimeUrl]?.taskLog ?? [],
  }));
};
