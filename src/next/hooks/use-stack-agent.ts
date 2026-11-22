import { useQueries } from '@tanstack/react-query';
import {
  buildScopedNotices,
  closedIdsFromPlans,
  foreignProject,
  readNotificationIds,
  type ScopedNotice,
} from '@/app/components/stack-panel/agent-task-model';
import { useScopeRuns } from '@/app/features/activity/hooks';
import { type ScopeRow, useScope } from '@/app/features/scope';
import { useNotifications, usePlans } from '@/app/hooks';
import { fetchPlansAt } from '@/app/services/content/entities-api';
import { plansQueryKey } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import type { AgentTaskState, TaskLogEntry } from '@/types/index';
import { dismissOwnNotice } from '../shell/stack-actions';
import { showQueueCard } from '../shell/stack-model';

const MAX_VISIBLE_TASKS = 1;

interface ScopedTask {
  task: AgentTaskState;
  project?: ScopeRow;
}

export interface StackAgentState {
  visible: ScopedTask[];
  hiddenCount: number;
  notices: ScopedNotice[];
  queueShown: boolean;
  openForeign: (project: ScopeRow, path: string) => void;
  dismissNotice: (entry: TaskLogEntry, project?: ScopeRow) => Promise<void>;
}

export function useStackAgent(): StackAgentState {
  const agentStatus = useAppStore((state) => state.agentStatus);
  const taskLog = useAppStore((state) => state.taskLog);
  const batchStatus = useAppStore((state) => state.batchStatus);
  const summaryDismissed = useAppStore((state) => state.batchSummaryDismissed);
  const scope = useScope(null);
  const { plans } = usePlans();
  const { notifications } = useNotifications();

  const rows = scope.groups.flatMap((group) => group.rows);
  const checked = rows.filter((row) => row.checked);
  const multiProject = checked.length > 1;
  const ownRow = multiProject ? rows.find((row) => row.isCurrent) : undefined;
  const otherRows = multiProject ? checked.filter((row) => !row.isCurrent) : [];
  const { runs: foreignRuns, markRead: markForeignRead } = useScopeRuns(otherRows);
  const foreignPlans = useQueries({
    queries: otherRows.map((project) => ({
      queryKey: plansQueryKey(project.runtimeUrl),
      queryFn: async () => (await fetchPlansAt(project.runtimeUrl)) ?? { entries: [] },
    })),
  });

  const readIds = new Set([
    ...readNotificationIds(notifications ?? []),
    ...foreignRuns.flatMap(({ notifications: foreignNotifications }) =>
      readNotificationIds(foreignNotifications),
    ),
  ]);
  const queueShown = showQueueCard(batchStatus?.batch, summaryDismissed);
  const allTasks: ScopedTask[] = [
    ...agentStatus
      .filter((task) => task.taskKind !== 'batch-run')
      .map((task) => ({ task, project: ownRow })),
    ...foreignRuns.flatMap(({ project, agentStatus: foreignStatus }) =>
      foreignStatus.map((task) => ({ task, project })),
    ),
  ];
  const visible = queueShown ? [] : allTasks.slice(0, MAX_VISIBLE_TASKS);
  const notices = buildScopedNotices(
    { taskLog, closedIds: closedIdsFromPlans(plans?.entries), project: ownRow },
    foreignRuns.map(({ project, taskLog: foreignTaskLog }, index) => ({
      project,
      taskLog: foreignTaskLog,
      closedIds: closedIdsFromPlans(foreignPlans[index]?.data?.entries),
    })),
    readIds,
  );

  return {
    visible,
    hiddenCount: allTasks.length - visible.length,
    notices,
    queueShown,
    openForeign: scope.openRow,
    dismissNotice: async (entry, project) => {
      const foreign = foreignProject(project);
      if (foreign) await markForeignRead(foreign, entry.id);
      else await dismissOwnNotice(entry.id);
    },
  };
}
