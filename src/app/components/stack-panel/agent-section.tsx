import { useScopeRuns } from '@/app/features/activity/hooks';
import { type ScopeRow, useScope } from '@/app/features/scope';
import { markRead, useNotifications, usePlans } from '@/app/hooks';
import { fetchPlansAt } from '@/app/services/content/entities-api';
import { plansQueryKey } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { interruptedNotices, logRowIdForTask } from '@/core/run-rows';
import {
  AGENT_LABELS,
  type AgentTaskState,
  type AgentTaskStatus,
  type Notification,
  type StoredNotification,
  type TaskKind,
  type TaskLogEntry,
} from '@/types/index';
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
import { CapacityRow } from './capacity-row';
import { formatLastRun, groupLabelClassName } from './shared';

const MAX_VISIBLE_TASKS = 1;

// On a wrapper, not inside the card: the card clips its content to the sketched outline.
const ProjectTab = ({ project }: { project: ScopeRow }) => (
  <span className="pointer-events-none absolute -top-2 right-3 z-10 max-w-[60%] truncate rounded-full bg-desk-chalk px-1.5 font-handwritten text-2xs leading-4 text-desk-bg">
    {project.name}
  </span>
);

// Shared by the task and capacity cards so they read as one stack. Their contents flex
// to fit it; nothing inside carries a height of its own.
export const TASK_CARD_HEIGHT_CLASS = 'h-[4.625rem]';
// Reserved so the Desk section below holds still as tasks start, finish, and clear.
const TASK_STACK_MIN_HEIGHT_CLASS = 'min-h-[4.625rem]';
// One line taller than the task cards: the capacity card carries a second bar row.
export const CAPACITY_CARD_HEIGHT_CLASS = 'h-[6.125rem]';

export const foreignProject = (project?: ScopeRow): ScopeRow | undefined =>
  project && !project.isCurrent ? project : undefined;

const isStoredNotification = (n: Notification): n is StoredNotification => n.kind !== 'question';

const readNotificationIds = (list: Notification[]): string[] =>
  list
    .filter(isStoredNotification)
    .filter((n) => n.read)
    .map((n) => n.id);

export const taskKindLabel = (task: AgentTaskState): string => {
  switch (task.taskKind) {
    case 'phase':
      return task.phaseIndex !== undefined ? `phase ${task.phaseIndex + 1}` : '';
    case 'audit':
      return 'audit';
    case 'batch-reconcile':
      return 'batch reconcile';
    case 'batch-draft':
      return 'batch draft';
    case 'reconcile':
      return 'reconcile';
    case 'fix-review':
      return 'fixing review comments';
    case 'draft':
      return 'drafting';
    case 'extend':
      return 'extending';
    case 'commit-suggest':
      return 'suggesting commit message';
    case 'overlap-check':
      return 'checking overlap';
    case 'sync':
      return 'syncing to main';
    case 'resolve-conflict':
      return 'resolving conflict';
    case 'run-all':
      return 'run all phases';
    case 'pr-review': {
      const prNumber = task.prReviewUrl?.match(/\/pull\/(\d+)/)?.[1];
      return prNumber ? `reviewing PR #${prNumber}` : 'reviewing PR';
    }
    default:
      return '';
  }
};

const SHORT_KIND_LABELS: Partial<Record<TaskKind, string>> = {
  phase: 'Phase',
  'run-all': 'Phases',
  'commit-suggest': 'Commit',
  'fix-review': 'Fix',
  'pr-review': 'Review',
  'batch-reconcile': 'Reconcile',
  reconcile: 'Reconcile',
  'batch-draft': 'Draft',
  draft: 'Draft',
  extend: 'Extend',
  audit: 'Audit',
  'overlap-check': 'Overlap',
  sync: 'Sync',
  'resolve-conflict': 'Conflict',
};

/** `Phases: IDEA-123` — the kind and the entity, not the whole title, so the id
 *  survives at panel width. Falls back to the title when there is no id. */
export const taskCardTitle = (task: AgentTaskState): string => {
  const kind = SHORT_KIND_LABELS[task.taskKind];
  if (!kind) return task.planId ?? task.planTitle;
  const numbered =
    task.taskKind === 'phase' && task.phaseIndex !== undefined
      ? `${kind} ${task.phaseIndex + 1}`
      : kind;
  return task.planId ? `${numbered}: ${task.planId}` : numbered;
};

export const taskSubtitle = (task: AgentTaskState): string => {
  const label = taskKindLabel(task);
  if (!label || label.toLowerCase() === task.planTitle.trim().toLowerCase()) return '';
  return ` — ${label}`;
};

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
  const openTaskPage = () =>
    foreign
      ? onOpenCrossProject(foreign, `/activity/${logRowIdForTask(task)}`)
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

interface ScopedNotice {
  entry: TaskLogEntry;
  project?: ScopeRow;
}

export const AgentSection = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const taskLog = useAppStore((s) => s.taskLog);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
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
  const closedIds = new Set(
    [...(plans?.entries ?? []), ...foreignPlansQueries.flatMap((q) => q.data?.entries ?? [])]
      .filter((plan) => plan.status === 'done' || plan.status === 'dropped')
      .map((plan) => plan.id)
      .filter((id): id is string => id !== undefined),
  );
  const readIds = new Set([
    ...readNotificationIds(notifications ?? []),
    ...foreignRuns.flatMap(({ notifications: foreignNotifications }) =>
      readNotificationIds(foreignNotifications),
    ),
  ]);

  const ownTask = multiProject ? currentScopeRow : undefined;
  const allTasks: ScopedTask[] = [
    ...agentStatus.map((task) => ({ task, project: ownTask })),
    ...foreignRuns.flatMap(({ project, agentStatus: foreignStatus }) =>
      foreignStatus.map((task) => ({ task, project })),
    ),
  ];
  const visibleTasks = allTasks.slice(0, MAX_VISIBLE_TASKS);
  const hiddenCount = allTasks.length - visibleTasks.length;
  const notices: ScopedNotice[] = [
    ...interruptedNotices(taskLog, { closedIds, readIds }).map((entry) => ({
      entry,
      project: ownTask,
    })),
    ...foreignRuns.flatMap(({ project, taskLog: foreignTaskLog }) =>
      interruptedNotices(foreignTaskLog, { closedIds, readIds }).map((entry) => ({
        entry,
        project,
      })),
    ),
  ];

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
        {visibleTasks.length > 0 ? (
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
    </div>
  );
};
