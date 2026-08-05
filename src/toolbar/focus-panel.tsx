import type { PlanEntry } from '@/types/index';
import { Checkbox } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { ToolbarLink } from './toolbar-link';

const titleStyle: CSSProperties = {
  fontWeight: 600,
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

export interface FocusPanelProps {
  plan: PlanEntry;
  onOpenIdea: () => void;
}

export const FocusPanel = ({ plan, onOpenIdea }: FocusPanelProps) => (
  <div>
    <div style={titleStyle}>{plan.id ? `${plan.id} — ${plan.title}` : plan.title}</div>
    <div style={listStyle}>
      {plan.phases.map((phase) => (
        <Checkbox key={phase.text} checked={phase.done} disabled label={phase.text} />
      ))}
    </div>
    <ToolbarLink onClick={onOpenIdea}>Open idea →</ToolbarLink>
  </div>
);
