import { useMemo } from 'react';
import { useWorklist } from '@/app/hooks/use-worklist';
import { type AttentionLine, deriveAttention, runningTasks } from '@/app/stores/attention';
import type { AgentTaskState } from '@/types/index';
import { useLogSnapshot } from './use-log-snapshot';
import { useProjectName } from './use-project-name';
import { type RepoStatus, useRepoStatus } from './use-repo-status';

export interface ProjectsScreenState {
  projectName: string | null;
  attentionReady: boolean;
  lines: AttentionLine[];
  loneRun: { task: AgentTaskState; total: number | undefined } | null;
  unreadCount: number;
  repo: RepoStatus;
}

export function useProjectsScreen(): ProjectsScreenState {
  const projectName = useProjectName();
  const { loading, rows, unreadCount } = useLogSnapshot();
  const { worklist } = useWorklist();
  const repo = useRepoStatus();
  return useMemo(() => {
    const running = runningTasks(rows);
    const task = running.length === 1 ? running[0] : null;
    const entityId = task ? (task.planId ?? task.ideaId) : undefined;
    const total = worklist?.find((entry) => entry.id === entityId)?.phasesTotal;
    return {
      projectName,
      attentionReady: !loading,
      lines: deriveAttention(rows),
      loneRun: task ? { task, total } : null,
      unreadCount,
      repo,
    };
  }, [projectName, loading, rows, unreadCount, worklist, repo]);
}
