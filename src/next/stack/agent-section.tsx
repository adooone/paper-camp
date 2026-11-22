import { useToast } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import {
  foreignProject,
  taskCardTitle,
  taskPagePath,
} from '@/app/components/stack-panel/agent-task-model';
import type { ScopeRow } from '@/app/features/scope';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { AGENT_LABELS, type AgentTaskState, type TaskLogEntry } from '@/types/index';
import { useStackAgent } from '../hooks/use-stack-agent';
import { SCREEN_PATHS } from '../shell/screens';
import { dismissQueueSummary, stopQueue, stopTask } from '../shell/stack-actions';
import { noticeTarget, queueCardView, taskCardView, taskTarget } from '../shell/stack-model';
import { Button } from '../ui/button';
import { CapacityCard } from './capacity-card';
import { ChalkCard, ChalkLabel } from './chalk';
import { SignedOutCard } from './signed-out-card';
import styles from './stack.module.css';
import { NoticeCard, QueueCard, TaskCard } from './task-card';

const SETTINGS_PATH = SCREEN_PATHS.settings;

const useFailureToast = () => {
  const { toast } = useToast();
  return (title: string) => (error: unknown) =>
    toast({
      title,
      description: oneLineErrorSummary((error as Error).message),
      variant: 'error',
    });
};

function QueueSlot() {
  const batchStatus = useAppStore((state) => state.batchStatus);
  const fail = useFailureToast();
  const batch = batchStatus?.batch;
  if (!batch) return null;
  const ideaTask = batchStatus?.ideaTask;
  const task = batchStatus?.task;
  const lastLine =
    ideaTask?.lines?.[ideaTask.lines.length - 1] ?? task?.lines?.[task.lines.length - 1];
  const view = queueCardView(batch, lastLine, AGENT_LABELS[task?.agentId ?? 'claude-code']);
  return (
    <QueueCard
      view={view}
      onStop={() => stopQueue().catch(fail('Failed to stop the queue'))}
      onDismiss={dismissQueueSummary}
    />
  );
}

function ScopedTaskCard({
  task,
  project,
  openForeign,
}: {
  task: AgentTaskState;
  project?: ScopeRow;
  openForeign: (project: ScopeRow, path: string) => void;
}) {
  const navigate = useNavigate();
  const fail = useFailureToast();
  const foreign = foreignProject(project);
  return (
    <TaskCard
      view={taskCardView(task, taskCardTitle(task))}
      chip={project?.name}
      onOpen={() =>
        foreign ? openForeign(foreign, taskPagePath(task)) : void navigate({ to: taskTarget(task) })
      }
      onStop={foreign ? undefined : () => stopTask(task.id).catch(fail('Failed to stop agent'))}
      onSignIn={() => void navigate({ to: SETTINGS_PATH })}
    />
  );
}

function ScopedNoticeCard({
  entry,
  project,
  openForeign,
  onDismiss,
}: {
  entry: TaskLogEntry;
  project?: ScopeRow;
  openForeign: (project: ScopeRow, path: string) => void;
  onDismiss: (entry: TaskLogEntry, project?: ScopeRow) => Promise<void>;
}) {
  const navigate = useNavigate();
  const fail = useFailureToast();
  const foreign = foreignProject(project);
  return (
    <NoticeCard
      title={entry.planId ?? entry.planTitle}
      chip={project?.name}
      onOpen={() =>
        foreign
          ? openForeign(foreign, `/activity/task:${entry.id}`)
          : void navigate({ to: noticeTarget(entry) })
      }
      onDismiss={() => onDismiss(entry, project).catch(fail('Failed to dismiss notice'))}
    />
  );
}

export function AgentSection() {
  const agent = useStackAgent();
  const navigate = useNavigate();
  const idle = !agent.queueShown && agent.visible.length === 0 && agent.notices.length === 0;
  return (
    <section className={styles.section} aria-label="Agent">
      <ChalkLabel
        side={
          agent.hiddenCount > 0 ? (
            <Button
              label="More"
              variant="ghost"
              size="xs"
              onPress={() => void navigate({ to: SCREEN_PATHS.log })}
            />
          ) : undefined
        }
      >
        Agent
      </ChalkLabel>
      <div className={styles.cards}>
        <SignedOutCard />
        {agent.queueShown ? <QueueSlot /> : null}
        {agent.visible.map(({ task, project }) => (
          <ScopedTaskCard
            key={task.id}
            task={task}
            project={project}
            openForeign={agent.openForeign}
          />
        ))}
        {idle ? (
          <ChalkCard>
            <span className={styles.muted}>No agent running.</span>
          </ChalkCard>
        ) : null}
        {agent.notices.map(({ entry, project }) => (
          <ScopedNoticeCard
            key={entry.id}
            entry={entry}
            project={project}
            openForeign={agent.openForeign}
            onDismiss={agent.dismissNotice}
          />
        ))}
        <CapacityCard />
      </div>
    </section>
  );
}
