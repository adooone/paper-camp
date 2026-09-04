import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import {
  AGENT_LABELS,
  type AgentTaskState,
  type AgentTaskStatus,
  type TaskKind,
} from '@/types/index';
import { Card, CloseIcon, IconButton, Stamp, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { CapacityRow } from './capacity-row';
import { chalkStatusFill, chalkStatusText, formatLastRun, groupLabelClassName } from './shared';

const MAX_VISIBLE_TASKS = 1;
// Shared by the task and capacity cards so they read as one stack. Their contents flex
// to fit it; nothing inside carries a height of its own.
const TASK_CARD_HEIGHT_CLASS = 'h-[4.625rem]';
// Reserved so the Desk section below holds still as tasks start, finish, and clear.
const TASK_STACK_MIN_HEIGHT_CLASS = 'min-h-[4.625rem]';

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

const statusFill: Record<AgentTaskStatus, string> = {
  starting: chalkStatusFill.running,
  running: chalkStatusFill.running,
  stopping: chalkStatusFill.running,
  done: chalkStatusFill.pass,
  error: chalkStatusFill.fail,
  superseded: chalkStatusFill.running,
};
const statusText: Record<AgentTaskStatus, string> = {
  starting: chalkStatusText.running,
  running: chalkStatusText.running,
  stopping: chalkStatusText.running,
  done: chalkStatusText.pass,
  error: chalkStatusText.fail,
  superseded: chalkStatusText.running,
};

const AgentTaskCard = ({
  task,
  onStop,
}: {
  task: AgentTaskState;
  onStop: (taskId: string) => Promise<void>;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const openTaskPage = () => navigate({ to: '/tasks', search: { taskId: task.id } });

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
    <Card surface="chalkboard" size="small" className={TASK_CARD_HEIGHT_CLASS}>
      {/* biome-ignore lint/a11y/useSemanticElements: the Stop IconButton nests inside, and a native <button> can't contain another button. */}
      <div
        role="button"
        tabIndex={0}
        onClick={openTaskPage}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTaskPage();
          }
        }}
        className="flex h-full min-w-0 cursor-pointer flex-col justify-between gap-1 rounded-[10px]"
      >
        <span className="min-w-0 truncate font-handwritten text-sm leading-tight text-desk-chalk">
          {taskCardTitle(task)}
        </span>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 shrink-0 whitespace-nowrap font-handwritten text-xs text-desk-text-muted">
            {AGENT_LABELS[task.agentId]} · {formatLastRun(task.startedAt)}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {task.status === 'error' && task.errorKind === 'auth' ? (
              // paper-ui has no clickable Stamp variant, so a raw button wraps it (see docs/CODE_STYLE.md §1)
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate({ to: '/settings/$section', params: { section: 'setup' } });
                }}
                className="bg-none bg-transparent border-none p-0 cursor-pointer"
              >
                <Stamp
                  surface="chalkboard"
                  size="small"
                  fillColor={statusFill.error}
                  textColor={statusText.error}
                  className="leading-none"
                >
                  stopped — agent signed out
                </Stamp>
              </button>
            ) : (
              <Stamp
                surface="chalkboard"
                size="small"
                fillColor={statusFill[task.status]}
                textColor={statusText[task.status]}
                className="leading-none"
              >
                {task.status}
              </Stamp>
            )}
            {(task.status === 'running' ||
              task.status === 'starting' ||
              task.status === 'stopping') && (
              <IconButton
                icon={<CloseIcon />}
                variant="ghost"
                size="small"
                label="Stop agent"
                onClick={handleStop}
                disabled={task.status === 'stopping'}
                className="h-auto min-h-0 w-auto shrink-0 p-0"
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export const AgentSection = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const navigate = useNavigate();
  const visibleTasks = agentStatus.slice(0, MAX_VISIBLE_TASKS);
  const hiddenCount = agentStatus.length - visibleTasks.length;

  return (
    <div className="flex min-h-0 flex-none flex-col p-[var(--pc-stack-pad)]">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className={`${groupLabelClassName} m-0`}>Agent</h3>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => navigate({ to: '/tasks' })}
            className="cursor-pointer border-none bg-transparent p-0 font-handwritten text-xs text-desk-text-muted underline"
          >
            more
          </button>
        )}
      </div>
      <div
        className={`flex shrink-0 flex-col justify-start gap-2 overflow-y-auto ${TASK_STACK_MIN_HEIGHT_CLASS}`}
      >
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task) => (
            <AgentTaskCard key={task.id} task={task} onStop={stopAgentTask} />
          ))
        ) : (
          <Card surface="chalkboard" size="small" className={TASK_CARD_HEIGHT_CLASS}>
            <div className="flex h-full items-center">
              <span className="font-handwritten text-desk-text-muted text-sm leading-tight">
                No agent running.
              </span>
            </div>
          </Card>
        )}
      </div>
      <div className="mt-2 shrink-0">
        <CapacityRow heightClassName={TASK_CARD_HEIGHT_CLASS} />
      </div>
    </div>
  );
};
