import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { AGENT_LABELS, type AgentTaskState, type AgentTaskStatus } from '@/types/index';
import { Card, CloseIcon, IconButton, Stamp, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { CapacityRow } from './capacity-row';
import { chalkStatusFill, chalkStatusText, formatLastRun, sectionLabelClassName } from './shared';

const MAX_VISIBLE_TASKS = 1;
// Fixed so card height doesn't vary with title/metadata truncation; 4.625rem is the
// minimum for the two-line layout (padding + row gap + title row + metadata/Stamp row).
const TASK_CARD_HEIGHT_CLASS = 'h-[4.625rem]';
// One card plus the "N more" row, reserved so the empty state doesn't shrink the
// panel when tasks finish and clear.
const TASK_STACK_MIN_HEIGHT_CLASS = 'basis-[6.625rem]';

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
    <Card surface="chalkboard" size="small" className={`stack-task-card ${TASK_CARD_HEIGHT_CLASS}`}>
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
        className="flex h-full min-w-0 cursor-pointer flex-col justify-center gap-1 rounded-[10px]"
      >
        <span className="block min-w-[6ch] overflow-hidden text-ellipsis whitespace-nowrap font-display-luminari text-sm font-semibold text-desk-chalk">
          {task.planTitle}
          {taskSubtitle(task)}
        </span>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-2xs text-desk-text-muted">
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
      <h3 className={`${sectionLabelClassName} m-0`}>Agent</h3>
      <div
        className={`flex min-h-0 flex-auto flex-col gap-2 overflow-y-auto ${TASK_STACK_MIN_HEIGHT_CLASS} ${
          visibleTasks.length > 0 ? 'justify-start' : 'justify-center'
        }`}
      >
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task) => (
            <AgentTaskCard key={task.id} task={task} onStop={stopAgentTask} />
          ))
        ) : (
          <Card surface="chalkboard" size="small">
            <p className="m-0 text-center text-xs opacity-50">No agent running.</p>
          </Card>
        )}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => navigate({ to: '/tasks' })}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-left text-xs text-desk-text-muted underline"
          >
            {hiddenCount} more…
          </button>
        )}
      </div>
      <div className="mt-2 shrink-0">
        <CapacityRow />
      </div>
    </div>
  );
};
