import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { summarizeQualityFailure, summarizeTestFailure } from '@/app/utils/check-summary';
import type { CheckStatus, ConsistencyIssue } from '@/types/index';
import { Card, CopyButton, Stamp, Tooltip } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import {
  chalkStatusFill,
  chalkStatusText,
  deskChalk,
  deskTextMuted,
  sectionLabelStyle,
} from './shared';

export const StatusSection = () => {
  const statusData = useAppStore((s) => s.status);
  const runCheck = useAppStore((s) => s.runCheck);
  const fixQuality = useAppStore((s) => s.fixQuality);
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const navigate = useNavigate();
  const [docIssuesExpanded, setDocIssuesExpanded] = useState(false);

  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(statusData),
    [statusData],
  );
  const anyChecksRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
  // `consistency` is doc findings (dangling refs, blocked plans), distinct from consistencyStatus (code check).
  const hasDocIssues = consistency.length > 0;

  const handleFindingClick = useCallback(
    (issue: ConsistencyIssue) => {
      if (issue.kind === 'blocked-plan-active' && issue.planId) {
        const blockedPlan = plans?.entries.find((p) => p.id === issue.planId);
        if (blockedPlan) {
          navigate({
            to: '/plans/$planId',
            params: { planId: encodeURIComponent(blockedPlan.title) },
          });
          return;
        }
      }
      setActiveDocTitle(issue.title);
      navigate({
        to: '/docs/$section',
        params: { section: issue.section === 'open-questions' ? 'questions' : 'decisions' },
      });
    },
    [plans?.entries, navigate, setActiveDocTitle],
  );

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        padding: space[6],
      }}
    >
      <div style={sectionLabelStyle}>Status</div>
      <Card surface="chalkboard" size="small" className="stack-card-fill">
        {(() => {
          const statusFill: Record<CheckStatus, string> = {
            ...chalkStatusFill,
            stale: 'transparent',
          };
          const statusText: Record<CheckStatus, string | undefined> = {
            ...chalkStatusText,
            stale: undefined,
          };
          const anyRunning = anyChecksRunning;
          const hasIssues = hasDocIssues;

          const qualityFixPrompt = `Fix the failing lint/format checks in this repo.\n\nLint output:\n${statusData?.lint?.output || '(none)'}\n\nFormat output:\n${statusData?.format?.output || '(none)'}`;
          const testFixPrompt = `Fix the failing tests in this repo. Output from the last test run:\n\n${statusData?.test?.output || '(no output captured)'}`;

          const checkButton = (opts: {
            label: string;
            status: CheckStatus;
            title: string;
            onClick: () => void;
          }) => (
            <Tooltip content={opts.title} surface="chalkboard">
              {/* Raw <button>: the clickable target is a Stamp, so it needs a
                  chrome-less wrapper rather than a component with its own button surface. */}
              <button
                type="button"
                className="stack-check-btn"
                onClick={() => {
                  if (!anyRunning) opts.onClick();
                }}
                disabled={anyRunning}
                style={{
                  cursor: anyRunning ? 'not-allowed' : 'pointer',
                  opacity: anyRunning && opts.status !== 'running' ? 0.5 : 1,
                  display: 'inline-flex',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                <Stamp
                  surface="chalkboard"
                  size="small"
                  fillColor={statusFill[opts.status]}
                  textColor={statusText[opts.status]}
                >
                  {opts.label}
                  <span style={{ visibility: opts.status === 'running' ? 'visible' : 'hidden' }}>
                    …
                  </span>
                </Stamp>
              </button>
            </Tooltip>
          );

          return (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: space[3],
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: space[2],
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                {checkButton({
                  label: 'Quality',
                  status: qualityStatus,
                  title: 'Run lint and format checks',
                  onClick: () => {
                    runCheck('lint');
                    runCheck('format');
                  },
                })}
                {checkButton({
                  label: 'Tests',
                  status: testStatus,
                  title: 'Run tests',
                  onClick: () => runCheck('test'),
                })}
                {checkButton({
                  label: 'Consistency',
                  status: consistencyStatus,
                  title: 'Run codebase consistency (knip + dependency-cruiser)',
                  onClick: () => runCheck('consistency'),
                })}
                <div>
                  <Tooltip
                    content={
                      hasIssues
                        ? 'Show plan/decision doc findings'
                        : 'No plan/decision doc findings'
                    }
                    surface="chalkboard"
                  >
                    <button
                      type="button"
                      className={hasIssues ? 'stack-check-btn' : undefined}
                      onClick={() => {
                        if (hasIssues) setDocIssuesExpanded((prev) => !prev);
                      }}
                      style={{
                        cursor: hasIssues ? 'pointer' : 'default',
                        display: 'inline-flex',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                      }}
                    >
                      <Stamp
                        surface="chalkboard"
                        size="small"
                        fillColor={hasIssues ? chalkStatusFill.fail : chalkStatusFill.pass}
                        textColor={hasIssues ? chalkStatusText.fail : chalkStatusText.pass}
                      >
                        Docs
                      </Stamp>
                    </button>
                  </Tooltip>
                  {docIssuesExpanded && hasIssues && (
                    <div
                      style={{
                        marginTop: space[2],
                        display: 'flex',
                        flexDirection: 'column',
                        gap: space[2],
                      }}
                    >
                      {consistency.map((issue, i) => (
                        <div
                          key={`${issue.kind}-${issue.title}-${i}`}
                          style={{
                            fontFamily: fontFamily.mono,
                            fontSize: fontSize['2xs'],
                            color: deskTextMuted,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleFindingClick(issue)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: deskChalk,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              font: 'inherit',
                              textAlign: 'left',
                            }}
                          >
                            {issue.message}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {(() => {
                // Exactly one (primaryLine, secondaryLine) pair per state, so this
                // slot is always exactly two lines tall — never fewer, never more —
                // and the stamps row above never recenters when state changes.
                let primaryLine: React.ReactNode;
                let secondaryLine: React.ReactNode = null;
                if (anyRunning) {
                  primaryLine = <span style={{ color: deskTextMuted }}>Running checks…</span>;
                } else if (qualityStatus === 'fail') {
                  primaryLine = (
                    <span style={{ color: deskTextMuted }}>
                      {summarizeQualityFailure(
                        statusData?.lint?.output ?? '',
                        statusData?.format?.output ?? '',
                      )}
                    </span>
                  );
                  secondaryLine = (
                    <button
                      type="button"
                      onClick={fixQuality}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: deskChalk,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        font: 'inherit',
                      }}
                    >
                      Suggested fix: run biome --write
                    </button>
                  );
                } else if (testStatus === 'fail') {
                  primaryLine = (
                    <span style={{ color: deskTextMuted }}>
                      {summarizeTestFailure(statusData?.test?.output ?? '')}
                    </span>
                  );
                  secondaryLine = (
                    <span style={{ color: deskChalk }}>
                      Suggested fix: <CopyButton text={testFixPrompt} surface="chalkboard" />
                    </span>
                  );
                } else if (consistencyStatus === 'fail') {
                  primaryLine = (
                    <span style={{ color: deskTextMuted }}>
                      Codebase consistency failed (knip / dependency-cruiser).
                    </span>
                  );
                  secondaryLine = (
                    <span style={{ color: deskTextMuted, opacity: 0.8 }}>
                      Run pnpm run consistency for details.
                    </span>
                  );
                } else if (hasDocIssues) {
                  primaryLine = (
                    <span style={{ color: deskTextMuted }}>
                      Plan/decision doc issues — see the Docs stamp.
                    </span>
                  );
                } else if (
                  qualityStatus === 'pass' &&
                  testStatus === 'pass' &&
                  consistencyStatus === 'pass'
                ) {
                  primaryLine = (
                    <span style={{ color: chalkStatusText.pass }}>All checks passing.</span>
                  );
                } else {
                  primaryLine = (
                    <span style={{ color: deskTextMuted, opacity: 0.6 }}>
                      Checks haven't run yet.
                    </span>
                  );
                }
                return (
                  <div
                    style={{
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: space[1],
                      fontFamily: fontFamily.handwritten,
                      fontSize: fontSize.sm,
                    }}
                  >
                    {primaryLine}
                    <span style={{ visibility: secondaryLine ? 'visible' : 'hidden' }}>
                      {secondaryLine ?? ' '}
                    </span>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </Card>
    </div>
  );
};
