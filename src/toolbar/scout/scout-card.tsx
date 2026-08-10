import type { ChecksClientState } from '@/app/hooks/use-checks-client';
import type { StatusClientState } from '@/app/hooks/use-status-client';
import type { CheckStatus, PlanEntry } from '@/types/index';
import { Island, Stamp, type StampVariant } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.625rem',
  width: 'min(24rem, calc(100vw - 2rem))',
};

// Bleeds across the Island's own padding (0.75rem 1.25rem) so the darker
// paper strip runs edge to edge; top radius nests inside the card's 28px.
const bannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  margin: '-0.75rem -1.25rem 0',
  padding: '0.5rem 1.25rem',
  background: 'rgba(61, 53, 43, 0.08)',
  borderBottom: '1px solid rgba(61, 53, 43, 0.12)',
  borderRadius: '27px 27px 0 0',
};

const branchStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  color: 'var(--pui-text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const mutedStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--pui-text-secondary)',
  whiteSpace: 'nowrap',
};

const columnsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
};

const glanceColumnStyle: CSSProperties = {
  flex: '1 1 0%',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  minWidth: 0,
};

const chatColumnStyle: CSSProperties = {
  flex: '2 1 0%',
  minWidth: 0,
};

const overallCheckVariant = (checks: ChecksClientState): StampVariant => {
  const statuses: CheckStatus[] = [
    checks.qualityStatus,
    checks.testStatus,
    checks.consistencyStatus,
  ];
  if (statuses.includes('fail') || checks.hasDocIssues) return 'error';
  if (statuses.includes('running')) return 'warning';
  if (statuses.every((status) => status === 'pass')) return 'success';
  return 'neutral';
};

export interface ScoutCardProps {
  status: StatusClientState;
  checks: ChecksClientState;
  focusPlan: PlanEntry | null;
}

export const ScoutCard = ({ status, checks, focusPlan }: ScoutCardProps) => {
  const branch = status.gitBranch ?? 'no branch';
  const doneCount = focusPlan?.phases.filter((phase) => phase.done).length ?? 0;

  return (
    <Island surface="paper" label="Paper camp">
      <div style={bodyStyle}>
        <div style={bannerStyle}>
          <code style={branchStyle} title={branch}>
            {branch}
          </code>
          {status.gitAhead > 0 && <span style={mutedStyle}>↑{status.gitAhead}</span>}
          <span style={mutedStyle}>
            {status.changedFileCount > 0 ? `${status.changedFileCount} changed` : 'clean'}
          </span>
        </div>

        <div style={columnsStyle}>
          <div style={glanceColumnStyle}>
            <span style={mutedStyle}>
              {focusPlan
                ? `${focusPlan.id ?? focusPlan.title} · phase ${doneCount}/${focusPlan.phases.length}`
                : 'no active plan'}
            </span>
            <Stamp size="small" variant={overallCheckVariant(checks)}>
              Checks
            </Stamp>
          </div>
          <div style={chatColumnStyle} />
        </div>
      </div>
    </Island>
  );
};
