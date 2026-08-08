import type { ChecksClientState } from '@/app/hooks/use-checks-client';
import type { StatusClientState } from '@/app/hooks/use-status-client';
import type { CheckStatus, PlanEntry } from '@/types/index';
import { Button, Island, Stamp, type StampVariant } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.625rem',
  minWidth: '17rem',
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

const glanceRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const spacerStyle: CSSProperties = { flex: 1 };

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

export interface IslandCardProps {
  status: StatusClientState;
  checks: ChecksClientState;
  focusPlan: PlanEntry | null;
  onOpenStack: () => void;
}

export const IslandCard = ({ status, checks, focusPlan, onOpenStack }: IslandCardProps) => {
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

        <div style={glanceRowStyle}>
          <span style={mutedStyle}>
            {focusPlan
              ? `${focusPlan.id ?? focusPlan.title} · phase ${doneCount}/${focusPlan.phases.length}`
              : 'no active plan'}
          </span>
          <Stamp size="small" variant={overallCheckVariant(checks)}>
            Checks
          </Stamp>
          <span style={spacerStyle} />
          <Button size="small" onClick={onOpenStack}>
            Stack
          </Button>
        </div>
      </div>
    </Island>
  );
};
