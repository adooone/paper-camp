import { ProgressBar } from '@/app/features/plans/components';
import { STATUS_COLOR, STATUS_LABEL } from '@/app/features/plans/constants';
import { type OpenQuestionGroup, phaseProgress } from '@/app/features/plans/helpers';
import type { StatusClientState } from '@/app/hooks/use-status-client';
import type { PlanEntry } from '@/types/index';
import { Island, Stamp } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { ScoutThread } from './scout-thread';

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

const stampRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
};

const phaseTextStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--pui-text-secondary)',
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
};

const progressRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
};

const progressBarWrapStyle: CSSProperties = { flex: 1, minWidth: 0 };

const progressCountStyle: CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--pui-text-secondary)',
  flexShrink: 0,
};

const deskLinkStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--pui-text-primary)',
};

export interface ScoutCardProps {
  status: StatusClientState;
  focusPlan: PlanEntry | null;
  openQuestions: OpenQuestionGroup[];
  onRefreshScout: () => void;
  deskUrl: string;
}

export const ScoutCard = ({
  status,
  focusPlan,
  openQuestions,
  onRefreshScout,
  deskUrl,
}: ScoutCardProps) => {
  const branch = status.gitBranch ?? 'no branch';
  const progress = focusPlan ? phaseProgress(focusPlan) : null;
  const currentPhase = focusPlan?.phases.find((phase) => !phase.done);

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
            {focusPlan ? (
              <>
                <div style={stampRowStyle}>
                  <Stamp size="small">{focusPlan.id ?? '—'}</Stamp>
                  <Stamp size="small">{STATUS_LABEL[focusPlan.status]}</Stamp>
                </div>
                <span style={phaseTextStyle}>
                  {currentPhase ? currentPhase.text : 'All phases done'}
                </span>
                {progress && (
                  <div style={progressRowStyle}>
                    <div style={progressBarWrapStyle}>
                      <ProgressBar pct={progress.pct} color={STATUS_COLOR[focusPlan.status]} />
                    </div>
                    <span style={progressCountStyle}>
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <span style={mutedStyle}>no active plan</span>
            )}
            <a style={deskLinkStyle} href={deskUrl} target="_blank" rel="noopener noreferrer">
              Open Paper Camp →
            </a>
          </div>
          <div style={chatColumnStyle}>
            <ScoutThread
              focusPlan={focusPlan}
              openQuestions={openQuestions}
              onRefresh={onRefreshScout}
            />
          </div>
        </div>
      </div>
    </Island>
  );
};
