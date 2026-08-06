import type { ChecksClientState } from '@/app/hooks/use-checks-client';
import type { StatusClientState } from '@/app/hooks/use-status-client';
import type { CheckStatus, PlanEntry } from '@/types/index';
import { Card, Stamp, type StampVariant } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { ToolbarLink } from './toolbar-link';

const sectionStyle: CSSProperties = {
  padding: '0.75rem 1rem 0',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const branchStyle: CSSProperties = { fontFamily: 'monospace', fontSize: '0.75rem' };
const mutedStyle: CSSProperties = { fontSize: '0.75rem', opacity: 0.6 };

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
};

const ideaTextStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const CHECK_STAMP_VARIANT: Record<CheckStatus, StampVariant> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

const BranchChecksCard = ({
  status,
  checks,
}: {
  status: StatusClientState;
  checks: ChecksClientState;
}) => (
  <Card surface="chalkboard" size="small">
    <div style={rowStyle}>
      <code style={branchStyle}>{status.gitBranch ?? 'no branch'}</code>
      {status.gitAhead > 0 && <span style={mutedStyle}>↑{status.gitAhead}</span>}
      <span style={mutedStyle}>
        {status.changedFileCount > 0 ? `${status.changedFileCount} changed` : 'clean'}
      </span>
    </div>
    <div style={rowStyle}>
      <Stamp size="small" surface="chalkboard" variant={CHECK_STAMP_VARIANT[checks.qualityStatus]}>
        Quality
      </Stamp>
      <Stamp size="small" surface="chalkboard" variant={CHECK_STAMP_VARIANT[checks.testStatus]}>
        Tests
      </Stamp>
      <Stamp
        size="small"
        surface="chalkboard"
        variant={CHECK_STAMP_VARIANT[checks.consistencyStatus]}
      >
        Consistency
      </Stamp>
      <Stamp size="small" surface="chalkboard" variant={checks.hasDocIssues ? 'error' : 'success'}>
        Docs
      </Stamp>
    </div>
  </Card>
);

const FocusCard = ({ plan, onOpenIdea }: { plan: PlanEntry; onOpenIdea: () => void }) => {
  const doneCount = plan.phases.filter((phase) => phase.done).length;
  return (
    <Card surface="chalkboard" size="small">
      <div style={titleRowStyle}>
        <span style={ideaTextStyle}>{plan.id ? `${plan.id} — ${plan.title}` : plan.title}</span>
        <ToolbarLink onClick={onOpenIdea}>Open →</ToolbarLink>
      </div>
      {plan.phases.length > 0 && (
        <span style={mutedStyle}>
          {doneCount}/{plan.phases.length} phases
        </span>
      )}
    </Card>
  );
};

const DeepLinksCard = ({ onOpenDesk }: { onOpenDesk: () => void }) => (
  <Card surface="chalkboard" size="small">
    <ToolbarLink onClick={onOpenDesk}>Open full desk →</ToolbarLink>
  </Card>
);

export interface ScoutGlanceCardsProps {
  status: StatusClientState;
  checks: ChecksClientState;
  focusPlan: PlanEntry | null;
  onOpenIdea: (plan: PlanEntry) => void;
  onOpenDesk: () => void;
}

export const ScoutGlanceCards = ({
  status,
  checks,
  focusPlan,
  onOpenIdea,
  onOpenDesk,
}: ScoutGlanceCardsProps) => (
  <div style={sectionStyle}>
    <BranchChecksCard status={status} checks={checks} />
    {focusPlan && <FocusCard plan={focusPlan} onOpenIdea={() => onOpenIdea(focusPlan)} />}
    <DeepLinksCard onOpenDesk={onOpenDesk} />
  </div>
);
