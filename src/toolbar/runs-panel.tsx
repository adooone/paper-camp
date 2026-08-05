import { AGENT_LABELS, type AgentTaskState } from '@/types/index';
import { Button, Stamp } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';

const titleStyle: CSSProperties = { fontWeight: 600, marginBottom: '0.5rem' };
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.375rem',
};
const listStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const mutedStyle: CSSProperties = { opacity: 0.6, fontSize: '0.75rem' };

const OUTCOME_VARIANT = { done: 'success', error: 'error' } as const;

const taskLabel = (task: AgentTaskState) =>
  `${task.taskKind}${task.phaseIndex !== undefined ? ` · phase ${task.phaseIndex + 1}` : ''} — ${task.planTitle}`;

export interface RunsPanelProps {
  activeTask: AgentTaskState | undefined;
  recentTasks: AgentTaskState[];
  stopping: boolean;
  launching: boolean;
  canRunNextPhase: boolean;
  onStop: () => void;
  onRunNextPhase: () => void;
}

export const RunsPanel = ({
  activeTask,
  recentTasks,
  stopping,
  launching,
  canRunNextPhase,
  onStop,
  onRunNextPhase,
}: RunsPanelProps) => (
  <div>
    <div style={titleStyle}>Runs</div>
    {activeTask ? (
      <div style={rowStyle}>
        <Stamp size="small" variant="warning">
          {AGENT_LABELS[activeTask.agentId]} · {taskLabel(activeTask)}
        </Stamp>
        <Button variant="ghost" size="small" disabled={stopping} onClick={onStop}>
          {stopping ? 'Stopping…' : 'Stop'}
        </Button>
      </div>
    ) : (
      <div style={rowStyle}>
        <span style={mutedStyle}>No agent running.</span>
        <Button
          variant="ghost"
          size="small"
          disabled={launching || !canRunNextPhase}
          onClick={onRunNextPhase}
        >
          {launching ? 'Starting…' : 'Run next phase'}
        </Button>
      </div>
    )}
    {recentTasks.length > 0 && (
      <div style={listStyle}>
        {recentTasks.map((task) => (
          <div key={task.id} style={rowStyle}>
            <Stamp size="small" variant={OUTCOME_VARIANT[task.status as 'done' | 'error']}>
              {task.status}
            </Stamp>
            <span style={mutedStyle}>{taskLabel(task)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);
