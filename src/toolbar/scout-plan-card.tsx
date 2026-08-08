import { ProgressBar } from '@/app/features/plans/components';
import { STATUS_LABEL } from '@/app/features/plans/constants';
import { phaseProgress } from '@/app/features/plans/helpers';
import type { PlanEntry } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { ToolbarLink } from './toolbar-link';

// Owner call: one fixed chalk-yellow bar, not the status-derived palette.
const PROGRESS_YELLOW = '#E2C25A';

const sectionStyle: CSSProperties = {
  padding: '0.75rem 1rem 0',
  flexShrink: 0,
};

// The desk Plans-table row's data (id · title · progress · status), reflowed
// for a narrow chalkboard card: stamps at the corners, then the title and the
// current phase as full-width wrapping blocks — nothing is ever truncated.
const stackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const stampRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
};

const progressBarStyle: CSSProperties = { flex: 1, minWidth: 0 };

const progressCountStyle: CSSProperties = { fontSize: '0.875rem', opacity: 0.6, flexShrink: 0 };

const phaseTextStyle: CSSProperties = {
  fontSize: '0.875rem',
  opacity: 0.7,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
};

const linkRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
};

export interface ScoutPlanCardProps {
  plan: PlanEntry;
  onOpenDesk: () => void;
}

export const ScoutPlanCard = ({ plan, onOpenDesk }: ScoutPlanCardProps) => {
  const progress = phaseProgress(plan);
  const currentPhase = plan.phases.find((phase) => !phase.done);

  return (
    <div style={sectionStyle}>
      <Card surface="chalkboard" size="small">
        <div style={stackStyle}>
          <div style={stampRowStyle}>
            <Stamp size="small" surface="chalkboard">
              {plan.id ?? '—'}
            </Stamp>
            <Stamp size="small" surface="chalkboard">
              {STATUS_LABEL[plan.status]}
            </Stamp>
          </div>
          <span style={titleStyle}>{plan.title}</span>
          {progress && (
            <div style={rowStyle}>
              <div style={progressBarStyle}>
                <ProgressBar pct={progress.pct} color={PROGRESS_YELLOW} />
              </div>
              <span style={progressCountStyle}>
                {progress.done}/{progress.total}
              </span>
            </div>
          )}
          <span style={phaseTextStyle}>
            {currentPhase ? `Current phase: ${currentPhase.text}` : 'All phases done'}
          </span>
          <div style={linkRowStyle}>
            <ToolbarLink onClick={onOpenDesk}>Open in desk →</ToolbarLink>
          </div>
        </div>
      </Card>
    </div>
  );
};
