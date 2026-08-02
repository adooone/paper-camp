import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { AGENT_LABELS, type AgentTaskState, type AgentTaskStatus } from '@/types/index';
import { Card, CloseIcon, CopyButton, IconButton, Stamp, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { chalkStatusFill, chalkStatusText, sectionLabelClassName } from './shared';

const AUTH_FIX_COMMANDS = ['claude auth login', 'claude setup-token'] as const;

const AuthErrorFix = () => (
  // biome-ignore lint/a11y/useKeyWithClickEvents: purely stops the copy click from bubbling to the card's onClick (which navigates to /tasks); nothing here is itself interactive.
  <div onClick={(e) => e.stopPropagation()} className="mt-2 flex flex-col gap-1">
    {AUTH_FIX_COMMANDS.map((cmd) => (
      <div key={cmd} className="flex items-center justify-between gap-2">
        <code className="font-mono text-xs text-desk-chalk">{cmd}</code>
        <CopyButton text={cmd} surface="chalkboard" />
      </div>
    ))}
  </div>
);

const MAX_VISIBLE_TASKS = 8;
// 25.5rem = MAX_VISIBLE_TASKS * 2.75rem card height + (MAX_VISIBLE_TASKS - 1) * 0.5rem gap,
// reserved so the empty state doesn't shrink the panel when tasks finish and clear.
const TASK_STACK_MIN_HEIGHT_CLASS = 'basis-[25.5rem]';

const taskSubtitle = (task: AgentTaskState): string => {
  switch (task.taskKind) {
    case 'phase':
      return task.phaseIndex !== undefined ? ` — phase ${task.phaseIndex + 1}` : '';
    case 'audit':
      return ' — audit';
    case 'batch-reconcile':
      return ' — batch reconcile';
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
    case 'run-all':
      return ' — run all phases';
    default:
      return '';
  }
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

  const statusFill: Record<AgentTaskStatus, string> = {
    starting: chalkStatusFill.running,
    running: chalkStatusFill.running,
    stopping: chalkStatusFill.running,
    done: chalkStatusFill.pass,
    error: chalkStatusFill.fail,
  };
  const statusText: Record<AgentTaskStatus, string> = {
    starting: chalkStatusText.running,
    running: chalkStatusText.running,
    stopping: chalkStatusText.running,
    done: chalkStatusText.pass,
    error: chalkStatusText.fail,
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
          <Stamp
            surface="chalkboard"
            size="small"
            fillColor={statusFill[task.status]}
            textColor={statusText[task.status]}
          >
            {task.status === 'error' && task.errorKind === 'auth' ? 'not signed in' : task.status}
          </Stamp>
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
      {task.status === 'error' && task.errorKind === 'auth' && <AuthErrorFix />}
    </Card>
  );
};

export const AgentSection = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const visibleTasks = agentStatus.slice(0, MAX_VISIBLE_TASKS);

  return (
    <div className="flex min-h-0 flex-auto flex-col p-6">
      <div className={sectionLabelClassName}>Agent</div>
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
