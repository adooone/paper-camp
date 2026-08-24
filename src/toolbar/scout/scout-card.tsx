import { WandIcon } from '@/app/components/icons';
import { ProgressBar } from '@/app/features/plans/components';
import { STATUS_COLOR, STATUS_LABEL } from '@/app/features/plans/constants';
import { type OpenQuestionGroup, phaseProgress } from '@/app/features/plans/helpers';
import type { StatusClientState } from '@/app/hooks/use-status-client';
import type { PlanEntry } from '@/types/index';
import { Button, Card, IconButton, Input, Island, Stamp } from '@dendelion/paper-ui';
import { type CSSProperties, useState } from 'react';
import { ScoutThread } from './scout-thread';

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 'min(34rem, calc(100vw - 2rem))',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
};

const bannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexShrink: 0,
  padding: '0.5rem 0.75rem',
  background: 'rgba(61, 53, 43, 0.08)',
  borderBottom: '1px solid rgba(61, 53, 43, 0.12)',
  borderRadius: '28px 28px 0 0',
};

// The banner above is full-bleed; this wrapper carries the padding instead.
const contentPaddingStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minHeight: 0,
  padding: '0.75rem',
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
  alignItems: 'stretch',
  gap: '0.75rem',
  flex: '1 1 auto',
  minHeight: 0,
};

const glanceColumnStyle: CSSProperties = {
  flex: '0 0 40%',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

// Top-down flow, not space-between, to avoid large content-less gaps; a
// flex spacer below pins the bottom row instead.
const glanceCardBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.625rem',
  height: '100%',
};

const glanceSpacerStyle: CSSProperties = { flex: 1, minHeight: '0.5rem' };

const chatColumnStyle: CSSProperties = {
  flex: '1 1 0%',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
};

const stampRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
};

const stampSpacerStyle: CSSProperties = { flex: 1 };

const titleTextStyle: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--pui-text-primary)',
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
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

const changedCountStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--pui-text-primary)',
  textAlign: 'center',
};

const commitInputWrapStyle: CSSProperties = { marginTop: '0.25rem' };

const pushRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};

const emptyCommitStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--pui-text-secondary)',
  textAlign: 'center',
};

// Overrides paper-ui's 0.875rem Input size to match deskLinkStyle's 0.75rem.
const commitInputTextStyle: CSSProperties = { fontSize: '0.75rem' };

const commitActionsRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  marginTop: '0.125rem',
};

const commitActionsSpacerStyle: CSSProperties = { flex: 1 };

// `.pc-scout-island` clips the full-bleed banner's square corners to the
// Island's own rounded border, which paper-ui's Island doesn't set itself.
const scoutCardCss = `
.pc-scout-island {
  overflow: hidden;
}
.pc-scout-id-stamp {
  /* Offsets the Stamp's own 0.75rem padding so its text aligns with the title below. */
  margin-left: -0.75rem;
}
.pc-scout-glance-card {
  height: 100%;
}`;

export interface ScoutCardProps {
  status: StatusClientState;
  focusPlan: PlanEntry | null;
  openQuestions: OpenQuestionGroup[];
  onRefreshScout: () => void;
  deskUrl: string;
  changesUrl: string;
}

export const ScoutCard = ({
  status,
  focusPlan,
  openQuestions,
  onRefreshScout,
  deskUrl,
  changesUrl,
}: ScoutCardProps) => {
  const branch = status.gitBranch ?? 'no branch';
  const progress = focusPlan ? phaseProgress(focusPlan) : null;
  const currentPhase = focusPlan?.phases.find((phase) => !phase.done);

  const [commitTitle, setCommitTitle] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  const handleSuggestCommit = async () => {
    const suggestion = await status.suggestCommit();
    if (suggestion) {
      setCommitTitle(suggestion.title);
      setCommitMessage(suggestion.message);
    }
  };

  const handleCommit = async () => {
    const ok = await status.commitWithTitle(commitTitle, commitMessage || undefined);
    if (ok) {
      setCommitTitle('');
      setCommitMessage('');
    }
  };

  return (
    <Island surface="paper" label="Paper camp" className="pc-scout-island">
      <style>{scoutCardCss}</style>
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

        <div style={contentPaddingStyle}>
          <div style={columnsStyle}>
            <div style={glanceColumnStyle}>
              <Card size="small" texture="canvas" className="pc-scout-glance-card">
                <div style={glanceCardBodyStyle}>
                  {focusPlan ? (
                    <>
                      <div style={stampRowStyle}>
                        <Stamp size="small" className="pc-scout-id-stamp">
                          {focusPlan.id ?? '—'}
                        </Stamp>
                        <span style={stampSpacerStyle} />
                        <Stamp size="small">{STATUS_LABEL[focusPlan.status]}</Stamp>
                      </div>
                      <span style={titleTextStyle}>{focusPlan.title}</span>
                      <span style={phaseTextStyle}>
                        {currentPhase ? currentPhase.text : 'All phases done'}
                      </span>
                      {progress && (
                        <div style={progressRowStyle}>
                          <div style={progressBarWrapStyle}>
                            <ProgressBar
                              pct={progress.pct}
                              color={STATUS_COLOR[focusPlan.status]}
                            />
                          </div>
                          <span style={progressCountStyle}>
                            {progress.done}/{progress.total}
                          </span>
                        </div>
                      )}
                      <a
                        style={deskLinkStyle}
                        href={deskUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Paper Camp →
                      </a>
                    </>
                  ) : (
                    <>
                      <span style={mutedStyle}>no active plan</span>
                      <a
                        style={deskLinkStyle}
                        href={deskUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Paper Camp →
                      </a>
                    </>
                  )}

                  <div style={glanceSpacerStyle} />

                  {status.changedFileCount > 0 ? (
                    <>
                      <a
                        style={changedCountStyle}
                        href={changesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {status.changedFileCount} {status.changedFileCount === 1 ? 'file' : 'files'}{' '}
                        changed
                      </a>

                      <div style={commitInputWrapStyle}>
                        <Input
                          size="small"
                          style={commitInputTextStyle}
                          placeholder="Commit message"
                          value={commitTitle}
                          onChange={(e) => setCommitTitle(e.currentTarget.value)}
                        />
                      </div>
                      <div style={commitActionsRowStyle}>
                        <Button
                          size="tiny"
                          disabled={!commitTitle.trim() || status.commitInFlight}
                          onClick={handleCommit}
                        >
                          {status.commitInFlight ? 'Committing…' : 'Commit'}
                        </Button>
                        <span style={commitActionsSpacerStyle} />
                        <IconButton
                          icon={<WandIcon size={14} />}
                          size="tiny"
                          label="Suggest commit message from the diff"
                          disabled={status.suggesting}
                          onClick={handleSuggestCommit}
                          wobble={status.suggesting ? 1 : 0}
                        />
                      </div>
                    </>
                  ) : status.gitAhead > 0 ? (
                    <div style={pushRowStyle}>
                      <Button size="tiny" disabled={status.gitActionBusy} onClick={status.onPush}>
                        {status.pushing
                          ? 'Pushing…'
                          : `Push ${status.gitAhead} commit${status.gitAhead === 1 ? '' : 's'}`}
                      </Button>
                    </div>
                  ) : (
                    <span style={emptyCommitStyle}>Nothing to commit</span>
                  )}
                </div>
              </Card>
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
      </div>
    </Island>
  );
};
