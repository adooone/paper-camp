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
  Alert,
  Button,
  Card,
  CloseIcon,
  CopyButton,
  Divider,
  IconButton,
  Input,
  Spinner,
  Stamp,
  Textarea,
  Tooltip,
} from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findFocusPlan } from '../features/plans/helpers';
import { commitChanges, pushChanges, suggestCommitMessage, syncToMain } from '../services/git-api';
import { useAppStore } from '../stores/app-store';
import { summarizeQualityFailure, summarizeTestFailure } from '../utils/check-summary';

const COMMIT_TITLE_STORAGE_KEY = 'papercamp.commitTitle';
const COMMIT_MESSAGE_STORAGE_KEY = 'papercamp.commitMessage';

// Subsystem-area scopes — keep in sync with .commitlintrc.json's `scope-enum`
// (release/main are release-bot-only and intentionally excluded from suggestions).
const COMMIT_SCOPES = [
  'core',
  'cli',
  'app',
  'server',
  'agent',
  'plans',
  'ideas',
  'docs',
  'settings',
  'stack',
  'ui',
  'ci',
  'config',
  'deps',
  'repo',
];

function readStoredCommitField(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStoredCommitField(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // localStorage unavailable (e.g. private browsing) — fall back to in-memory only
  }
}

const WandIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m12 3-1.6 4.85a2 2 0 0 1-1.27 1.27L4.27 10.7l4.86 1.6a2 2 0 0 1 1.27 1.27L12 18.4l1.6-4.86a2 2 0 0 1 1.27-1.27l4.86-1.6-4.86-1.6a2 2 0 0 1-1.27-1.27L12 3Z" />
    <path d="M19 3v3" />
    <path d="M20.5 4.5h-3" />
  </svg>
);

const PushIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);

const MergeIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M6 9v5c0 .667 3 1 6 1s6-.333 6-1V9" />
    <path d="M12 17v2" />
  </svg>
);

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
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: fontFamily.serif,
  fontSize: fontSize.base,
  fontWeight: 600,
  color: deskTextMuted,
  marginBottom: space[3],
};

export const StackPanel = ({ open, onToggle }: StackPanelProps) => {
  const plans = useAppStore((s) => s.plans);
  const loadProgress = useAppStore((s) => s.loadProgress);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const statusData = useAppStore((s) => s.status);
  const loadStatus = useAppStore((s) => s.loadStatus);
  const runCheck = useAppStore((s) => s.runCheck);
  const fixQuality = useAppStore((s) => s.fixQuality);
  const consistency = useAppStore((s) => s.consistency);
  const loadConsistency = useAppStore((s) => s.loadConsistency);
  const setActiveDocSection = useAppStore((s) => s.setActiveDocSection);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const setActivePlanTitle = useAppStore((s) => s.setActivePlanTitle);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadAgentStatus = useAppStore((s) => s.loadAgentStatus);
  const stopAgentTask = useAppStore((s) => s.stopAgent);
  const [docIssuesExpanded, setDocIssuesExpanded] = useState(false);
  const [commitExpanded, setCommitExpanded] = useState(false);
  const [agentLogExpanded, setAgentLogExpanded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitTitle, setCommitTitle] = useState(() =>
    readStoredCommitField(COMMIT_TITLE_STORAGE_KEY),
  );
  const [commitMessage, setCommitMessage] = useState(() =>
    readStoredCommitField(COMMIT_MESSAGE_STORAGE_KEY),
  );
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
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

  const activePlan = useMemo(() => findFocusPlan(plans?.entries), [plans?.entries]);

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
  const anyChecksFailing =
    qualityStatus === 'fail' ||
    testStatus === 'fail' ||
    consistencyStatus === 'fail' ||
    hasDocIssues;
  const agentActive =
    agentStatus?.status === 'running' ||
    agentStatus?.status === 'starting' ||
    agentStatus?.status === 'stopping';

  const suggestedScope = useMemo(() => {
    // Scope is a subsystem area, never the plan id. Prefer the plan's first tag
    // that's a known scope (matches AGENTS.md's "usually the plan's primary tag"
    // rule); fall back to `repo`. The plan id goes in the Refs: footer instead.
    const tagScope = activePlan?.tags?.find((t) => COMMIT_SCOPES.includes(t));
    return tagScope ?? 'repo';
  }, [activePlan]);

  const allPhasesDone = useMemo(
    () => Boolean(activePlan?.phases.length) && activePlan!.phases.every((phase) => phase.done),
    [activePlan],
  );

  const suggestedTitle = useMemo(() => {
    if (!activePlan) return '';
    const kind = activePlan.kind ?? 'feat';
    if (allPhasesDone) return `${kind}(${suggestedScope}): updates`;
    return `${kind}(${suggestedScope}): ${activePlan.title}`;
  }, [activePlan, suggestedScope, allPhasesDone]);

  const suggestedMessage = useMemo(() => {
    if (!activePlan) return '';
    // Plan id lives in a Refs: footer (commit-scope convention), not the scope.
    const refs = activePlan.id ? `Refs: ${activePlan.id}` : '';
    const phaseBody =
      !allPhasesDone && activePlan.phases.length
        ? activePlan.phases.map((phase) => `- ${phase.text}`).join('\n')
        : '';
    return [phaseBody, refs].filter(Boolean).join('\n\n');
  }, [activePlan, allPhasesDone]);

  useEffect(() => {
    if (suggestedTitle && !commitTitle) {
      setCommitTitle(suggestedTitle);
    }
  }, [suggestedTitle, commitTitle]);

  useEffect(() => {
    if (suggestedMessage && !commitMessage) {
      setCommitMessage(suggestedMessage);
    }
  }, [suggestedMessage, commitMessage]);

  useEffect(() => {
    writeStoredCommitField(COMMIT_TITLE_STORAGE_KEY, commitTitle);
  }, [commitTitle]);

  useEffect(() => {
    writeStoredCommitField(COMMIT_MESSAGE_STORAGE_KEY, commitMessage);
  }, [commitMessage]);

  useEffect(() => {
    if (gitStatus) {
      setSelectedFiles(new Set(gitStatus.map((e) => e.path)));
    }
  }, [gitStatus]);

  const handleToggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim()) return;
    setCommitting(true);
    setCommitError(null);
    try {
      await commitChanges(
        [...selectedFiles],
        commitTitle.trim(),
        commitMessage.trim() || undefined,
      );
      setCommitTitle(suggestedTitle);
      setCommitMessage('');
      setCommitExpanded(false);
      await loadGitStatus();
    } catch (err) {
      setCommitError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  }, [commitTitle, commitMessage, selectedFiles, suggestedTitle, loadGitStatus]);

  const handlePush = useCallback(async () => {
    setPushing(true);
    setPushError(null);
    try {
      await pushChanges();
      await loadGitStatus();
    } catch (err) {
      setPushError((err as Error).message);
    } finally {
      setPushing(false);
    }
  }, [loadGitStatus]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const isClean = gitStatus && gitStatus.length === 0;
      await syncToMain(isClean ? 'clean' : 'dirty');
      await loadGitStatus();
    } catch (err) {
      setSyncError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [gitStatus, loadGitStatus]);

  const handleSuggestFromChanges = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestCommitMessage([...selectedFiles]);
      setCommitTitle(result.title);
      setCommitMessage(result.message);
    } catch (err) {
      setSuggestError((err as Error).message);
    } finally {
      setSuggesting(false);
    }
  }, [selectedFiles]);

  const handleFindingClick = useCallback(
    (issue: ConsistencyIssue) => {
      if (issue.kind === 'blocked-plan-active' && issue.planId) {
        const blockedPlan = plans?.entries.find((p) => p.id === issue.planId);
        if (blockedPlan) {
          setActivePlanTitle(blockedPlan.title);
          navigate({ to: '/' });
          return;
        }
      }
      setActiveDocSection(issue.section === 'open-questions' ? 'questions' : 'decisions');
      setActiveDocTitle(issue.title);
      navigate({ to: '/docs' });
    },
    [plans?.entries, navigate, setActivePlanTitle, setActiveDocSection, setActiveDocTitle],
  );

  return (
    <>
      <AnimatePresence>
        {!open && (
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
            <IconButton
              icon={
                agentActive ? (
                  <Spinner size="small" surface="chalkboard" label="Agent running" />
                ) : anyChecksFailing ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#d6a0a0',
                      boxShadow: '0 0 6px rgba(214, 160, 160, 0.9)',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: fontSize['2xs'] }}>S</span>
                )
              }
              surface="chalkboard"
              size="small"
              label={
                agentActive
                  ? 'Open stack panel — agent running'
                  : anyChecksFailing
                    ? 'Open stack panel — checks failing'
                    : 'Open stack panel'
              }
              onClick={onToggle}
              style={{
                width: 28,
                height: 64,
                borderRadius: '6px 0 0 6px',
                boxShadow: agentActive
                  ? 'inset 0 0 0 1px rgba(214, 196, 160, 0.6)'
                  : anyChecksFailing
                    ? 'inset 0 0 0 1px rgba(214, 160, 160, 0.6)'
                    : undefined,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        animate={{ x: open ? 0 : '100%' }}
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
          <IconButton
            icon={<span style={{ fontSize: fontSize.sm, lineHeight: 1 }}>&times;</span>}
            surface="chalkboard"
            size="small"
            label="Close stack panel"
            onClick={onToggle}
            style={{ width: 28, height: 28, border: `1px solid ${deskBorder}` }}
          />
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
                          : agentStatus.taskKind === 'batch-audit'
                            ? ' — batch audit'
                            : agentStatus.taskKind === 'draft'
                              ? ' — drafting'
                              : agentStatus.taskKind === 'extend'
                                ? ' — extending'
                                : agentStatus.taskKind === 'commit-suggest'
                                  ? ' — suggesting commit message'
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

          <div
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: space[6],
            }}
          >
            <div
              style={{ ...sectionLabelStyle, display: 'flex', alignItems: 'center', gap: space[2] }}
            >
              Commit
              {gitBranch && (
                <Stamp surface="chalkboard" size="small">
                  {gitBranch}
                </Stamp>
              )}
            </div>
            <Card surface="chalkboard" size="small" className="stack-card-fill">
              {gitStatus && gitStatus.length > 0 ? (
                <>
                  <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
                    <Accordion
                      title={`${gitStatus.length} file${gitStatus.length === 1 ? '' : 's'} changed`}
                      expanded={commitExpanded}
                      onToggle={() => setCommitExpanded(!commitExpanded)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: space[2],
                          paddingTop: space[2],
                        }}
                      >
                        {gitStatus.map((entry) => (
                          <label
                            key={entry.path}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: space[2],
                              fontFamily: fontFamily.mono,
                              fontSize: fontSize['2xs'],
                              color: deskChalk,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedFiles.has(entry.path)}
                              onChange={() => handleToggleFile(entry.path)}
                              style={{ accentColor: deskChalk }}
                            />
                            <span
                              style={{
                                color: entry.staged ? deskChalk : deskTextMuted,
                                minWidth: 24,
                              }}
                            >
                              {entry.status}
                            </span>
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {entry.path}
                            </span>
                          </label>
                        ))}
                      </div>
                    </Accordion>
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: space[3],
                      marginTop: space[3],
                    }}
                  >
                    {suggestError && (
                      <Alert
                        surface="chalkboard"
                        dismissible
                        onDismiss={() => setSuggestError(null)}
                      >
                        {suggestError}
                      </Alert>
                    )}
                    <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <Input
                          surface="chalkboard"
                          size="small"
                          placeholder="Commit title"
                          value={commitTitle}
                          onChange={(e) => setCommitTitle(e.currentTarget.value)}
                        />
                      </div>
                      <IconButton
                        icon={<WandIcon size={16} />}
                        surface="chalkboard"
                        size="small"
                        label="Suggest title and message from the diff"
                        disabled={selectedFiles.size === 0 || suggesting}
                        onClick={handleSuggestFromChanges}
                        wobble={suggesting ? 1 : 0}
                      />
                    </div>
                    <Textarea
                      surface="chalkboard"
                      size="small"
                      placeholder="Commit message (optional)"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.currentTarget.value)}
                      rows={2}
                    />
                    {commitError && (
                      <Alert
                        surface="chalkboard"
                        dismissible
                        onDismiss={() => setCommitError(null)}
                      >
                        {commitError}
                      </Alert>
                    )}
                    <Button
                      surface="chalkboard"
                      size="small"
                      fullWidth
                      disabled={selectedFiles.size === 0 || !commitTitle.trim() || committing}
                      onClick={handleCommit}
                    >
                      {committing ? 'Committing…' : 'Commit'}
                    </Button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: space[3],
                  }}
                >
                  {gitAhead > 0 ? (
                    <>
                      <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>
                        All changes committed — {gitAhead} commit{gitAhead === 1 ? '' : 's'} ready
                        to push.
                      </p>
                      {pushError && (
                        <Alert
                          surface="chalkboard"
                          dismissible
                          onDismiss={() => setPushError(null)}
                        >
                          {pushError}
                        </Alert>
                      )}
                      <Button
                        surface="chalkboard"
                        size="small"
                        icon={<PushIcon size={14} />}
                        disabled={pushing}
                        onClick={handlePush}
                      >
                        {pushing
                          ? 'Pushing…'
                          : `Push ${gitAhead} commit${gitAhead === 1 ? '' : 's'}`}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>
                        No changed files.
                      </p>
                      {syncError && (
                        <Alert
                          surface="chalkboard"
                          dismissible
                          onDismiss={() => setSyncError(null)}
                        >
                          {syncError}
                        </Alert>
                      )}
                      <Tooltip
                        content={
                          gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : undefined
                        }
                        surface="chalkboard"
                      >
                        <Button
                          surface="chalkboard"
                          size="small"
                          icon={<MergeIcon size={14} />}
                          disabled={syncing || gitBranchHygiene === 'clean-on-main'}
                          onClick={handleSync}
                        >
                          {syncing ? 'Syncing…' : 'Sync to main'}
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </motion.div>
    </>
  );
};
