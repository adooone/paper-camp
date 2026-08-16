import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { AGENT_LABELS, type AgentTaskState, type AgentTaskStatus } from '@/types/index';
import { Card, CloseIcon, IconButton, Stamp, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { chalkStatusFill, chalkStatusText, sectionLabelClassName } from './shared';

const MAX_VISIBLE_TASKS = 3;
// 9.25rem = 3 cards * 2.75rem card height + 2 gaps * 0.5rem, reserved so the
// empty state doesn't shrink the panel when tasks finish and clear.
const TASK_STACK_MIN_HEIGHT_CLASS = 'basis-[9.25rem]';

const taskSubtitle = (task: AgentTaskState): string => {
  switch (task.taskKind) {
    case 'phase':
      return task.phaseIndex !== undefined ? ` — phase ${task.phaseIndex + 1}` : '';
    case 'audit':
      return ' — audit';
    case 'batch-reconcile':
      return ' — batch reconcile';
    case 'batch-draft':
      return ' — batch draft';
    case 'reconcile':
      return ' — reconcile';
    case 'fix-review':
      return ' — fixing review comments';
    case 'draft':
      return ' — drafting';
    case 'extend':
      return ' — extending';
    case 'commit-suggest':
      return ' — suggesting commit message';
    case 'overlap-check':
      return ' — checking overlap';
    case 'sync':
      return ' — syncing to main';
    case 'resolve-conflict':
      return ' — resolving conflict';
    case 'run-all':
      return ' — run all phases';
    case 'pr-review': {
      const prNumber = task.prReviewUrl?.match(/\/pull\/(\d+)/)?.[1];
      return prNumber ? ` — reviewing PR #${prNumber}` : ' — reviewing PR';
    }
    default:
      return '';
  }
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
    <Card surface="chalkboard" size="small" className="stack-task-card">
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
        className="flex cursor-pointer items-center justify-between gap-2 rounded-[10px]"
      >
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-display-luminari text-sm font-semibold text-desk-chalk">
          {task.planTitle}
          {taskSubtitle(task)} · {AGENT_LABELS[task.agentId]}
        </span>
        <div className="flex items-center gap-2">
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
    </Card>
  );
};

export const AgentSection = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const visibleTasks = agentStatus.slice(0, MAX_VISIBLE_TASKS);

  return (
    <div className="flex min-h-0 flex-none flex-col p-6">
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
      </div>
    </div>
  );
};
