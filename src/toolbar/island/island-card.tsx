import type { ChecksClientState } from '@/app/hooks/use-checks-client';
import type { StatusClientState } from '@/app/hooks/use-status-client';
import type { CheckStatus, PlanEntry } from '@/types/index';
import { Island, Stamp, type StampVariant } from '@dendelion/paper-ui';
import type { CSSProperties, ReactNode } from 'react';

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  minWidth: '15rem',
};

const stateLineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const branchStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  color: 'var(--pui-text-primary)',
};

const mutedStyle: CSSProperties = { fontSize: '0.75rem', color: 'var(--pui-text-secondary)' };

const spacerStyle: CSSProperties = { flex: 1 };

const actionLineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  flexWrap: 'wrap',
};

const footerStyle: CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--pui-text-secondary)',
};

const BRANCH_MAX = 28;

const middleTruncate = (text: string, max: number) => {
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
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

export interface IslandCardProps {
  status: StatusClientState;
  checks: ChecksClientState;
  focusPlan: PlanEntry | null;
  actions?: ReactNode;
}

export const IslandCard = ({ status, checks, focusPlan, actions }: IslandCardProps) => {
  const branch = status.gitBranch ?? 'no branch';
  const doneCount = focusPlan?.phases.filter((phase) => phase.done).length ?? 0;

  return (
    <Island surface="paper" label="Paper camp">
      <div style={bodyStyle}>
        <div style={stateLineStyle}>
          <code style={branchStyle}>{middleTruncate(branch, BRANCH_MAX)}</code>
          {status.gitAhead > 0 && <span style={mutedStyle}>↑{status.gitAhead}</span>}
          <span style={mutedStyle}>
            {status.changedFileCount > 0 ? `${status.changedFileCount} changed` : 'clean'}
          </span>
          <span style={spacerStyle} />
          <Stamp size="small" variant={overallCheckVariant(checks)}>
            Checks
          </Stamp>
        </div>

        {actions && <div style={actionLineStyle}>{actions}</div>}

        {focusPlan && (
          <span style={footerStyle}>
            {focusPlan.id ?? focusPlan.title} · phase {doneCount}/{focusPlan.phases.length}
          </span>
        )}
      </div>
    </Island>
  );
};
