import { color, fontFamily, fontSize, layout, lineHeight, space } from '@/app/styles/tokens';
import type { CheckStatus, ConsistencyIssue } from '@/types/index';
import { Card, CopyButton, Divider, IconButton, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import { summarizeQualityFailure, summarizeTestFailure } from '../utils/check-summary';

const CHALKBOARD_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15 0 0 0 0 0.28 0 0 0 0 0.20 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)' opacity='1'/%3E%3C/svg%3E")`;

const deskBg = color.deskBg;
const deskLight = color.deskLight;
const deskText = color.deskText;
const deskTextMuted = color.deskTextMuted;
const deskBorder = color.deskBorder;
const deskChalk = color.deskChalk;

interface StackPanelProps {
  open: boolean;
  onToggle: () => void;
  // When pinned (large screens), the panel is always visible and can't be closed:
  // the reopen handle and the close button are both hidden.
  pinned?: boolean;
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: fontFamily.serif,
  fontSize: fontSize.base,
  fontWeight: 600,
  color: deskTextMuted,
  marginBottom: space[3],
};

export const StackPanel = ({ open, onToggle, pinned = false }: StackPanelProps) => {
  const isOpen = open || pinned;
  const plans = useAppStore((s) => s.plans);
  const progress = useAppStore((s) => s.progress);
  const loadProgress = useAppStore((s) => s.loadProgress);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const statusData = useAppStore((s) => s.status);
  const loadStatus = useAppStore((s) => s.loadStatus);
  const fixQuality = useAppStore((s) => s.fixQuality);
  const consistency = useAppStore((s) => s.consistency);
  const loadConsistency = useAppStore((s) => s.loadConsistency);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const refreshRef = useRef({
    loadProgress,
    loadPlans,
    loadStatus,
    loadConsistency,
    loadGitStatus,
  });
  refreshRef.current = {
    loadProgress,
    loadPlans,
    loadStatus,
    loadConsistency,
    loadGitStatus,
  };

  useEffect(() => {
    refreshRef.current.loadProgress();
    refreshRef.current.loadStatus();
    refreshRef.current.loadConsistency();
    refreshRef.current.loadGitStatus();
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/activity/stream');
    es.onmessage = () => {
      refreshRef.current.loadProgress();
      refreshRef.current.loadPlans();
      refreshRef.current.loadStatus();
      refreshRef.current.loadConsistency();
      refreshRef.current.loadGitStatus();
    };
    return () => es.close();
  }, []);

  const qualityStatus: CheckStatus = useMemo(() => {
    const lintStatus = statusData?.lint?.status ?? 'stale';
    const formatStatus = statusData?.format?.status ?? 'stale';
    if (lintStatus === 'running' || formatStatus === 'running') return 'running';
    if (lintStatus === 'fail' || formatStatus === 'fail') return 'fail';
    if (lintStatus === 'stale' && formatStatus === 'stale') return 'stale';
    return 'pass';
  }, [statusData]);
  const testStatus: CheckStatus = statusData?.test?.status ?? 'stale';
  // Codebase consistency (knip + dependency-cruiser) — mirrors the CI "Consistency" job.
  const consistencyStatus: CheckStatus = statusData?.consistency?.status ?? 'stale';
  const anyChecksRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
  // Plan/decision *document* consistency (dangling refs, blocked plans) — a separate
  // concern from the code-consistency check.
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
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              // Above the Layout header (z-200): the panel sits outside the main
              // layout, so nothing from it may paint on top of the stack.
              zIndex: 300,
              borderRadius: '6px 0 0 6px',
              background: deskBg,
              backgroundImage: `${CHALKBOARD_TEXTURE}, linear-gradient(135deg, ${deskLight} 0%, ${deskBg} 60%)`,
              backgroundRepeat: 'repeat, no-repeat',
              backgroundSize: '200px 200px, auto',
              boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
            }}
          >
            {/* Plain reopen handle — the header status cluster (IDEA-39) is now the
                persistent ambient signal for agent/check state, so this no longer
                doubles as one. */}
            <IconButton
              icon={<span style={{ fontSize: fontSize['2xs'] }}>S</span>}
              surface="chalkboard"
              size="small"
              label="Open stack panel"
              onClick={onToggle}
              style={{
                width: 28,
                height: 64,
                borderRadius: '6px 0 0 6px',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.3,
          ease: [0.4, 0, 0.2, 1],
        }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: layout.stackPanelWidth,
          borderLeft: '4px solid rgba(61, 53, 43, 0.12)',
          backgroundColor: deskBg,
          backgroundImage: `${CHALKBOARD_TEXTURE}, linear-gradient(135deg, ${deskLight} 0%, ${deskBg} 60%)`,
          backgroundRepeat: 'repeat, no-repeat',
          backgroundSize: '200px 200px, auto',
          color: deskText,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          // Above the Layout header (z-200) — the panel owns the full right edge.
          zIndex: 300,
        }}
      >
        <div
          style={{
            height: 80,
            padding: `0 ${space[6]}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: fontFamily.serif,
              fontSize: fontSize.base,
              fontWeight: 700,
              color: deskChalk,
            }}
          >
            Stack
          </span>
          {!pinned && (
            <IconButton
              icon={<span style={{ fontSize: fontSize.sm, lineHeight: 1 }}>&times;</span>}
              surface="chalkboard"
              size="small"
              label="Close stack panel"
              onClick={onToggle}
              style={{ width: 28, height: 28, border: `1px solid ${deskBorder}` }}
            />
          )}
        </div>
        <Divider surface="chalkboard" />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: fontFamily.body,
          }}
        >
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              padding: space[6],
            }}
          >
            <div style={sectionLabelStyle}>Branch</div>
            <Card surface="chalkboard" size="small" className="stack-card-fill">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: space[2],
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: fontSize.sm,
                    color: deskChalk,
                  }}
                >
                  {gitBranch ?? 'unknown'}
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: space[2],
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}
                >
                  {gitStatus && gitStatus.length > 0 && (
                    <Stamp surface="chalkboard" size="small">
                      {gitStatus.length} changed
                    </Stamp>
                  )}
                  {gitAhead > 0 && (
                    <Stamp surface="chalkboard" size="small">
                      {gitAhead} ahead
                    </Stamp>
                  )}
                  {gitBranchHygiene === 'stale-merged' && (
                    <Stamp
                      surface="chalkboard"
                      size="small"
                      fillColor="#5a4a2d"
                      textColor="#d6c4a0"
                    >
                      stale — merged
                    </Stamp>
                  )}
                </div>
              </div>
            </Card>
          </div>
          <Divider surface="chalkboard" />

          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              padding: space[6],
            }}
          >
            <div style={sectionLabelStyle}>Findings</div>
            <Card surface="chalkboard" size="small" className="stack-card-fill">
              {(() => {
                const testFixPrompt = `Fix the failing tests in this repo. Output from the last test run:\n\n${statusData?.test?.output || '(no output captured)'}`;

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
                    {(() => {
                      let primaryLine: React.ReactNode;
                      let secondaryLine: React.ReactNode = null;
                      if (anyChecksRunning) {
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
                            Plan/decision doc issues — see below.
                          </span>
                        );
                      } else if (
                        qualityStatus === 'pass' &&
                        testStatus === 'pass' &&
                        consistencyStatus === 'pass'
                      ) {
                        primaryLine = <span style={{ color: '#b5d6b5' }}>All checks passing.</span>;
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
                    {hasDocIssues && (
                      <div
                        style={{
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
                );
              })()}
            </Card>
          </div>
          <Divider surface="chalkboard" />

          <div
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: space[6],
              overflow: 'hidden',
            }}
          >
            <div style={sectionLabelStyle}>Activity</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {progress.length === 0 ? (
                <p style={{ opacity: 0.5, fontSize: fontSize.xs }}>No activity yet.</p>
              ) : (
                progress.map((entry, i) => (
                  <div
                    key={entry.date}
                    style={{
                      marginBottom: space[6],
                      paddingBottom: space[4],
                      borderBottom: i < progress.length - 1 ? `1px solid ${deskBorder}` : undefined,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: fontFamily.serif,
                        fontWeight: 600,
                        fontSize: fontSize.sm,
                        color: deskChalk,
                        margin: `0 0 ${space[2]}`,
                        lineHeight: lineHeight.tight,
                      }}
                    >
                      {entry.date}
                    </div>
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: space[2],
                      }}
                    >
                      {entry.items.map((item, j) => (
                        <li
                          key={`${entry.date}-${j}`}
                          style={{
                            fontFamily: fontFamily.handwritten,
                            fontSize: fontSize.base,
                            fontWeight: 400,
                            lineHeight: lineHeight.tight,
                            color: deskText,
                            paddingLeft: space[3],
                            borderLeft: `2px solid ${deskBorder}`,
                            opacity: 0.9,
                          }}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};
