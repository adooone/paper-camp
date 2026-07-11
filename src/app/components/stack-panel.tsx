import { color, fontFamily, fontSize, layout, lineHeight, space } from '@/app/styles/tokens';
import {
  AGENT_LABELS,
  type AgentTaskStatus,
  type CheckStatus,
  type ConsistencyIssue,
  type TaskKind,
} from '@/types/index';
import {
  Accordion,
  Button,
  Card,
  CloseIcon,
  CopyButton,
  Divider,
  IconButton,
  Stamp,
  Tooltip,
} from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const loadProgress = useAppStore((s) => s.loadProgress);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const statusData = useAppStore((s) => s.status);
  const loadStatus = useAppStore((s) => s.loadStatus);
  const runCheck = useAppStore((s) => s.runCheck);
  const fixQuality = useAppStore((s) => s.fixQuality);
  const consistency = useAppStore((s) => s.consistency);
  const loadConsistency = useAppStore((s) => s.loadConsistency);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadAgentStatus = useAppStore((s) => s.loadAgentStatus);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const [docIssuesExpanded, setDocIssuesExpanded] = useState(false);
  const [agentLogExpanded, setAgentLogExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const refreshRef = useRef({
    loadProgress,
    loadPlans,
    loadStatus,
    loadConsistency,
    loadGitStatus,
    loadAgentStatus,
  });
  refreshRef.current = {
    loadProgress,
    loadPlans,
    loadStatus,
    loadConsistency,
    loadGitStatus,
    loadAgentStatus,
  };

  useEffect(() => {
    refreshRef.current.loadProgress();
    refreshRef.current.loadStatus();
    refreshRef.current.loadConsistency();
    refreshRef.current.loadGitStatus();
    refreshRef.current.loadAgentStatus();
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/activity/stream');
    es.onmessage = () => {
      refreshRef.current.loadProgress();
      refreshRef.current.loadPlans();
      refreshRef.current.loadStatus();
      refreshRef.current.loadConsistency();
      refreshRef.current.loadGitStatus();
      refreshRef.current.loadAgentStatus();
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
  // concern from the code-consistency check, surfaced in its own "Docs" stamp.
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
            <div style={sectionLabelStyle}>Agent</div>
            <Card surface="chalkboard" size="small" className="stack-card-fill">
              {agentStatus ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: space[2],
                      marginBottom: space[1],
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: fontFamily.serif,
                        fontWeight: 600,
                        fontSize: fontSize.sm,
                        color: deskChalk,
                        // minWidth: 0 lets this flex item shrink below its content
                        // width — without it overflow/ellipsis never triggers.
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {agentStatus.planTitle}
                      {agentStatus.taskKind === 'phase' && agentStatus.phaseIndex !== undefined
                        ? ` — phase ${agentStatus.phaseIndex + 1}`
                        : agentStatus.taskKind === 'audit'
                          ? ' — audit'
                          : agentStatus.taskKind === 'batch-reconcile'
                            ? ' — batch reconcile'
                            : agentStatus.taskKind === 'reconcile'
                              ? ' — reconcile'
                              : agentStatus.taskKind === 'fix-review'
                                ? ' — fixing review comments'
                                : agentStatus.taskKind === 'draft'
                                  ? ' — drafting'
                                  : agentStatus.taskKind === 'extend'
                                    ? ' — extending'
                                    : agentStatus.taskKind === 'commit-suggest'
                                      ? ' — suggesting commit message'
                                      : agentStatus.taskKind === 'overlap-check'
                                        ? ' — checking overlap'
                                        : agentStatus.taskKind === 'sync'
                                          ? ' — syncing to main'
                                          : agentStatus.taskKind === 'run-all'
                                            ? ' — run all phases'
                                            : ''}{' '}
                      · {AGENT_LABELS[agentStatus.agentId]}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                      {(() => {
                        const statusFill: Record<AgentTaskStatus, string> = {
                          starting: '#5a4a2d',
                          running: '#5a4a2d',
                          stopping: '#5a4a2d',
                          done: '#2d5a3b',
                          error: '#5a2d2d',
                        };
                        const statusText: Record<AgentTaskStatus, string> = {
                          starting: '#d6c4a0',
                          running: '#d6c4a0',
                          stopping: '#d6c4a0',
                          done: '#b5d6b5',
                          error: '#d6a0a0',
                        };
                        return (
                          <Stamp
                            surface="chalkboard"
                            size="small"
                            fillColor={statusFill[agentStatus.status]}
                            textColor={statusText[agentStatus.status]}
                          >
                            {agentStatus.status}
                          </Stamp>
                        );
                      })()}
                      {(agentStatus.status === 'running' ||
                        agentStatus.status === 'starting' ||
                        agentStatus.status === 'stopping') && (
                        <IconButton
                          icon={<CloseIcon />}
                          variant="ghost"
                          size="small"
                          label="Stop agent"
                          onClick={stopAgentTask}
                          disabled={agentStatus.status === 'stopping'}
                        />
                      )}
                    </div>
                  </div>
                  {agentStatus.lines.length > 0 && (
                    <>
                      <span
                        style={{
                          fontFamily: fontFamily.mono,
                          fontSize: fontSize['2xs'],
                          color: deskTextMuted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: space[2],
                          flexShrink: 0,
                        }}
                      >
                        {agentStatus.lines[agentStatus.lines.length - 1]}
                      </span>
                      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
                        <Accordion
                          title={`${agentStatus.lines.length} line${agentStatus.lines.length === 1 ? '' : 's'}`}
                          expanded={agentLogExpanded}
                          onToggle={() => setAgentLogExpanded(!agentLogExpanded)}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: space[1],
                              fontFamily: fontFamily.mono,
                              fontSize: fontSize['2xs'],
                              color: deskTextMuted,
                              paddingTop: space[2],
                              maxHeight: 160,
                              overflowY: 'auto',
                            }}
                          >
                            {agentStatus.lines.map((line, i) => (
                              <span key={`${i}-${line}`} style={{ whiteSpace: 'pre-wrap' }}>
                                {line}
                              </span>
                            ))}
                          </div>
                        </Accordion>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>
                    No agent running.
                  </p>
                </div>
              )}
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
            <div style={sectionLabelStyle}>Status</div>
            <Card surface="chalkboard" size="small" className="stack-card-fill">
              {(() => {
                const statusFill: Record<CheckStatus, string> = {
                  pass: '#2d5a3b',
                  fail: '#5a2d2d',
                  running: '#5a4a2d',
                  stale: 'transparent',
                };
                const statusText: Record<CheckStatus, string | undefined> = {
                  pass: '#b5d6b5',
                  fail: '#d6a0a0',
                  running: '#d6c4a0',
                  stale: undefined,
                };
                const anyRunning = anyChecksRunning;
                const hasIssues = hasDocIssues;

                const qualityFixPrompt = `Fix the failing lint/format checks in this repo.\n\nLint output:\n${statusData?.lint?.output || '(none)'}\n\nFormat output:\n${statusData?.format?.output || '(none)'}`;
                const testFixPrompt = `Fix the failing tests in this repo. Output from the last test run:\n\n${statusData?.test?.output || '(no output captured)'}`;

                // One shape for the three check-run stamps (Quality / Tests / Consistency),
                // each a click-to-run button colored by its check status. Extracted per the
                // repo's "3 copies = extract" rule; the Docs stamp below is a different shape
                // (a findings toggle) and stays separate.
                const checkButton = (opts: {
                  label: string;
                  status: CheckStatus;
                  title: string;
                  onClick: () => void;
                }) => (
                  <Tooltip content={opts.title} surface="chalkboard">
                    {/* Raw <button>, not paper-ui Button/IconButton: the clickable target
                        is a Stamp with its own chalkboard chrome, so we need a bare,
                        chrome-less button wrapping it rather than a component that draws
                        its own button surface. */}
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
                        <span
                          style={{ visibility: opts.status === 'running' ? 'visible' : 'hidden' }}
                        >
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
                          {/* Raw <button> for the same reason as the check stamps above:
                              the clickable target is a Stamp, so no paper-ui Button/IconButton
                              equivalent fits. */}
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
                              fillColor={hasIssues ? '#5a2d2d' : '#2d5a3b'}
                              textColor={hasIssues ? '#d6a0a0' : '#b5d6b5'}
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
                            {secondaryLine ?? ' '}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </Card>
          </div>
        </div>
      </motion.div>
    </>
  );
};
