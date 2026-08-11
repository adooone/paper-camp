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

// scout-trigger.tsx's `.pc-scout-card > section` rule strips the Island's
// own padding to 0, so this sits directly against the true edges with no
// bleed trick needed — no negative margin, no radius-matching. Its own top
// corners still need to curve with the Island (`.pc-scout-island`'s
// overflow: hidden alone won't reliably clip a short banner against the
// Island's corner arc — see IDEA-147 thread), so it carries a matching
// radius directly.
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

// All the padding the Island's own section used to carry now lives here,
// on a wrapper below the banner — the banner is full-bleed, everything
// else keeps the original inset.
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

// Natural top-down flow, not space-between — stretching a handful of lines
// across the full column height (matching the chat column) left large,
// content-less gaps between them. A single flex spacer (below) does the same
// full-height fill job by pinning the desk link / Build row to the bottom;
// everything above it keeps a normal, consistent gap.
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

// paper-ui's Input "small" size is 0.875rem — matches deskLinkStyle's
// 0.75rem instead, so the composer reads at the same scale as the
// "Open Paper Camp" link above it. `style` spreads straight onto the
// native <input> in paper-ui's Input, so this overrides the module class.
const commitInputTextStyle: CSSProperties = { fontSize: '0.75rem' };

const commitActionsRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  marginTop: '0.125rem',
};

const commitActionsSpacerStyle: CSSProperties = { flex: 1 };

// Card sets no height of its own; this fills the glance column so it matches
// the chat column's stretched full-panel height. `.pc-scout-island` clips
// the Island's own content to its rounded border — paper-ui's Island doesn't
// set overflow: hidden itself, so without this the full-bleed banner's
// square corners poke out past the Island's curve instead of being cut to it.
const scoutCardCss = `
.pc-scout-island {
  overflow: hidden;
}
.pc-scout-id-stamp {
  /* Stamp's small size has 0.75rem horizontal padding for its own organic
     blob shape (paper-ui stamp.module.scss), so its box is flush-left but
     the "IDEA-4" text inside sits 12px in from that edge — visibly offset
     from the plain title text below it. Pull the stamp itself left by
     exactly that padding so both read as starting from the same edge. */
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
