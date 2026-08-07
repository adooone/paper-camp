import { AGENT_LABELS, type AgentTaskState, type PlanEntry } from '@/types/index';
import { Button, Checkbox, Stamp } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { ToolbarLink } from './toolbar-link';
import { ToolbarPanelCard } from './toolbar-side-panel';

const titleStyle: CSSProperties = {
  fontWeight: 600,
  marginBottom: '0.5rem',
};

const runRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.5rem',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  maxHeight: '12rem',
  overflowY: 'auto',
  marginBottom: '0.5rem',
};

const taskLabel = (task: AgentTaskState) =>
  `${task.taskKind}${task.phaseIndex !== undefined ? ` · phase ${task.phaseIndex + 1}` : ''} — ${task.planTitle}`;

export interface FocusPanelProps {
  plan: PlanEntry;
  onOpenIdea: () => void;
  activeTask: AgentTaskState | undefined;
  stopping: boolean;
  launching: boolean;
  canRunNextPhase: boolean;
  onStop: () => void;
  onRunNextPhase: () => void;
}

export const FocusPanel = ({
  plan,
  onOpenIdea,
  activeTask,
  stopping,
  launching,
  canRunNextPhase,
  onStop,
  onRunNextPhase,
}: FocusPanelProps) => (
  <ToolbarPanelCard>
    <div style={titleStyle}>{plan.id ? `${plan.id} — ${plan.title}` : plan.title}</div>
    <div style={runRowStyle}>
      {activeTask ? (
        <>
          <Stamp size="small" variant="warning">
            {AGENT_LABELS[activeTask.agentId]} · {taskLabel(activeTask)}
          </Stamp>
          <Button variant="ghost" size="small" disabled={stopping} onClick={onStop}>
            {stopping ? 'Stopping…' : 'Stop'}
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="small"
          disabled={launching || !canRunNextPhase}
          onClick={onRunNextPhase}
        >
          {launching ? 'Starting…' : 'Run next phase'}
        </Button>
      )}
    </div>
    <div style={listStyle}>
      {plan.phases.map((phase) => (
        <Checkbox key={phase.text} checked={phase.done} disabled label={phase.text} />
      ))}
    </div>
    <ToolbarLink onClick={onOpenIdea}>Open idea →</ToolbarLink>
  </ToolbarPanelCard>
);
