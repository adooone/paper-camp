import {
  Button,
  Card,
  CloseIcon,
  IconButton,
  Stamp,
  type StampVariant,
  Tooltip,
  useToast,
} from '@dendelion/folk-ui';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useScopeRuns } from '@/app/features/activity/hooks';
import { BatchSheet } from '@/app/features/plans/modals/batch-sheet';
import { type ScopeRow, useScope } from '@/app/features/scope';
import { markRead, useNotifications, usePlans } from '@/app/hooks';
import { fetchPlansAt } from '@/app/services/content/entities-api';
import { plansQueryKey } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { logRowIdForTask } from '@/core/run-rows';
import {
  AGENT_LABELS,
  type AgentTaskState,
  type AgentTaskStatus,
  type TaskLogEntry,
} from '@/types/index';
import {
  buildScopedNotices,
  closedIdsFromPlans,
  foreignProject,
  readNotificationIds,
  type ScopedNotice,
  taskCardTitle,
  taskPagePath,
} from './agent-task-model';
import { BatchTaskCard } from './batch-task-card';
import { CapacityRow } from './capacity-row';
import {
  CAPACITY_CARD_HEIGHT_CLASS,
  formatLastRun,
  groupLabelClassName,
  TASK_CARD_HEIGHT_CLASS,
} from './shared';
import { SignedOutCard } from './signed-out-card';

export {
  buildScopedNotices,
  closedIdsFromPlans,
  foreignProject,
  taskCardTitle,
  taskKindLabel,
  taskPagePath,
  taskSubtitle,
} from './agent-task-model';

const MAX_VISIBLE_TASKS = 1;

// On a wrapper, not inside the card: the card clips its content to the sketched outline.
const ProjectTab = ({ project }: { project: ScopeRow }) => (
  <span className="pointer-events-none absolute -top-2 right-3 z-10 max-w-[60%] truncate rounded-full bg-desk-chalk px-1.5 font-handwritten text-2xs leading-4 text-desk-bg">
    {project.name}
  </span>
);

const TASK_STACK_MIN_HEIGHT_CLASS = 'min-h-[4.625rem]';

const statusVariant: Record<AgentTaskStatus, StampVariant> = {
  starting: 'warning',
  running: 'warning',
  stopping: 'warning',
  done: 'success',
  error: 'error',
  superseded: 'warning',
};

const AgentTaskCard = ({
  task,
  project,
  onOpenCrossProject,
  onStop,
}: {
  task: AgentTaskState;
  project?: ScopeRow;
  onOpenCrossProject: (project: ScopeRow, path: string) => void;
  onStop: (taskId: string) => Promise<void>;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const foreign = foreignProject(project);
  const taskPath = taskPagePath(task);
  const openTaskPage = () =>
    foreign
      ? onOpenCrossProject(foreign, taskPath)
      : task.taskKind === 'chat'
        ? navigate({ to: '/chat' })
        : navigate({
            to: '/activity/$entryId',
            params: { entryId: logRowIdForTask(task) },
          });

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onStop(task.id);
    } catch (err) {
      toast({
        title: 'Failed to stop agent',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  return (
    <div className="relative">
      {project && <ProjectTab project={project} />}
      <Card
        surface="chalkboard"
        size="small"
        className={TASK_CARD_HEIGHT_CLASS}
        onClick={openTaskPage}
        ariaLabel={taskCardTitle(task)}
      >
        <div className="flex h-full min-w-0 flex-col justify-between gap-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 truncate font-handwritten text-sm leading-tight text-desk-chalk">
              {taskCardTitle(task)}
            </span>
            {!foreign &&
              (task.status === 'running' ||
                task.status === 'starting' ||
                task.status === 'stopping') && (
                <IconButton
                  icon={<CloseIcon size={20} />}
                  variant="ghost"
                  size="tiny"
                  surface="chalkboard"
                  label="Stop agent"
                  onClick={handleStop}
                  disabled={task.status === 'stopping'}
                />
              )}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 truncate whitespace-nowrap font-handwritten text-xs text-desk-text-muted">
              {AGENT_LABELS[task.agentId]} · {formatLastRun(task.startedAt)}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {task.status === 'error' && task.errorKind === 'auth' ? (
                <Tooltip
                  content="Click to sign back in from Settings → Connections."
                  surface="chalkboard"
                >
                  <Stamp
                    surface="chalkboard"
                    size="small"
                    variant="error"
                    className="leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate({ to: '/project/settings/$section', params: { section: 'setup' } });
                    }}
                  >
                    stopped — agent signed out
                  </Stamp>
                </Tooltip>
              ) : (
                <Stamp
                  surface="chalkboard"
                  size="small"
                  variant={statusVariant[task.status]}
                  className="leading-none"
                >
                  {task.status}
                </Stamp>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

const InterruptedNoticeCard = ({
  entry,
  project,
  onOpenCrossProject,
  onDismiss,
}: {
  entry: TaskLogEntry;
  project?: ScopeRow;
  onOpenCrossProject: (project: ScopeRow, path: string) => void;
  onDismiss: (entry: TaskLogEntry, project?: ScopeRow) => Promise<void>;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const foreign = foreignProject(project);
  const openEntry = () =>
    foreign
      ? onOpenCrossProject(foreign, `/activity/task:${entry.id}`)
      : navigate({ to: '/activity/$entryId', params: { entryId: `task:${entry.id}` } });

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onDismiss(entry, project);
    } catch (err) {
      toast({
        title: 'Failed to dismiss notice',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  return (
    <div className="relative">
      {project && <ProjectTab project={project} />}
      <Card
        surface="chalkboard"
        size="small"
        className={TASK_CARD_HEIGHT_CLASS}
        onClick={openEntry}
        ariaLabel={entry.planId ?? entry.planTitle}
      >
        <div className="flex h-full min-w-0 flex-col justify-between gap-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 truncate font-handwritten text-sm leading-tight text-desk-chalk">
              {entry.planId ?? entry.planTitle}
            </span>
            <IconButton
              icon={<CloseIcon size={20} />}
              variant="ghost"
              size="tiny"
              surface="chalkboard"
              label="Dismiss"
              onClick={handleDismiss}
            />
          </div>
          <Tooltip content="Click to open the run and retry it." surface="chalkboard">
            <Stamp
              surface="chalkboard"
              size="small"
              variant="warning"
              className="w-fit leading-none"
            >
              A run was interrupted; run again
            </Stamp>
          </Tooltip>
        </div>
      </Card>
    </div>
  );
};

interface ScopedTask {
  task: AgentTaskState;
  project?: ScopeRow;
}

export const AgentSection = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const taskLog = useAppStore((s) => s.taskLog);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const batchStatus = useAppStore((s) => s.batchStatus);
  const batchSummaryDismissed = useAppStore((s) => s.batchSummaryDismissed);
  const navigate = useNavigate();
  const scope = useScope(null);
  const allScopeRows = scope.groups.flatMap((g) => g.rows);
  const checkedScopeRows = allScopeRows.filter((r) => r.checked);
  const currentScopeRow = allScopeRows.find((r) => r.isCurrent);
  const multiProject = checkedScopeRows.length > 1;
  const otherScopeProjects = multiProject ? checkedScopeRows.filter((r) => !r.isCurrent) : [];
  const { runs: foreignRuns, markRead: markForeignRead } = useScopeRuns(otherScopeProjects);

  const { plans } = usePlans();
  const { notifications } = useNotifications();
  const foreignPlansQueries = useQueries({
    queries: otherScopeProjects.map((project) => ({
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

  const ownTask = multiProject ? currentScopeRow : undefined;
  // A batch-run task's own progress (items, pause reason) has no counterpart on
  // AgentTaskState, so it gets its own card (BatchTaskCard) instead of the generic one.
  const showBatchCard = Boolean(
    batchStatus?.batch && !(batchStatus.batch.status === 'done' && batchSummaryDismissed),
  );
  const allTasks: ScopedTask[] = [
    ...agentStatus
      .filter((task) => task.taskKind !== 'batch-run')
      .map((task) => ({ task, project: ownTask })),
    ...foreignRuns.flatMap(({ project, agentStatus: foreignStatus }) =>
      foreignStatus.map((task) => ({ task, project })),
    ),
  ];
  const visibleTasks = showBatchCard ? [] : allTasks.slice(0, MAX_VISIBLE_TASKS);
  const hiddenCount = allTasks.length - visibleTasks.length;
  const notices: ScopedNotice[] = buildScopedNotices(
    { taskLog, closedIds: closedIdsFromPlans(plans?.entries), project: ownTask },
    foreignRuns.map(({ project, taskLog: foreignTaskLog }, i) => ({
      project,
      taskLog: foreignTaskLog,
      closedIds: closedIdsFromPlans(foreignPlansQueries[i]?.data?.entries),
    })),
    readIds,
  );

  const handleDismissNotice = async (entry: TaskLogEntry, project?: ScopeRow) => {
    const foreign = foreignProject(project);
    if (foreign) {
      await markForeignRead(foreign, entry.id);
    } else {
      await markRead(entry.id);
    }
  };

  return (
    <div className="flex min-h-0 flex-none flex-col p-[var(--pc-stack-pad)]">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className={`${groupLabelClassName} m-0`}>Agent</h3>
        {hiddenCount > 0 && (
          <Button
            variant="link"
            onClick={() => navigate({ to: '/activity' })}
            className="font-handwritten text-xs text-desk-text-muted"
          >
            more
          </Button>
        )}
      </div>
      <div
        className={`flex shrink-0 flex-col justify-start gap-2 overflow-y-auto pt-2 ${TASK_STACK_MIN_HEIGHT_CLASS}`}
      >
        <SignedOutCard />
        {showBatchCard ? (
          <BatchTaskCard />
        ) : visibleTasks.length > 0 ? (
          visibleTasks.map(({ task, project }) => (
            <AgentTaskCard
              key={task.id}
              task={task}
              project={project}
              onOpenCrossProject={scope.openRow}
              onStop={stopAgentTask}
            />
          ))
        ) : notices.length === 0 ? (
          <Card surface="chalkboard" size="small" className={TASK_CARD_HEIGHT_CLASS}>
            <div className="flex h-full items-center">
              <span className="font-handwritten text-desk-text-muted text-sm leading-tight">
                No agent running.
              </span>
            </div>
          </Card>
        ) : null}
        {notices.map(({ entry, project }) => (
          <InterruptedNoticeCard
            key={entry.id}
            entry={entry}
            project={project}
            onOpenCrossProject={scope.openRow}
            onDismiss={handleDismissNotice}
          />
        ))}
      </div>
      <div className="mt-2 shrink-0">
        <CapacityRow heightClassName={CAPACITY_CARD_HEIGHT_CLASS} />
      </div>
      <BatchSheet />
    </div>
  );
};
