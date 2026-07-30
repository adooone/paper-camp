import { findFocusPlan } from '@/app/features/plans/helpers';
import { useBranchSync } from '@/app/hooks/use-branch-sync';
import { commitChanges, suggestCommitMessage } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { summarizeQualityFailure, summarizeTestFailure } from '@/app/utils/check-summary';
import type {
  BranchHygieneStatus,
  CheckStatus,
  ConsistencyIssue,
  DecisionEntry,
  GitStatusEntry,
  PlanEntry,
} from '@/types/index';
import {
  Accordion,
  Alert,
  Button,
  Card,
  CopyButton,
  IconButton,
  Input,
  Stamp,
  Textarea,
  Tooltip,
  useToast,
} from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MergeIcon, PullIcon, PushIcon, WandIcon } from '../icons';
import { ViewDecisionModal } from '../view-decision-modal';
import {
  chalkStatusFill,
  chalkStatusText,
  deskChalk,
  deskTextMuted,
  gitErrorSummary,
  sectionLabelStyle,
} from './shared';

const COMMIT_MESSAGE_STORAGE_KEY = 'papercamp.commitMessage';

// Keep in sync with .commitlintrc.json's `scope-enum` (release/main are release-bot-only, excluded here).
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

function deriveSuggestedCommit(plan: PlanEntry | undefined): { title: string; message: string } {
  // A finished plan (every phase done) has nothing meaningful to derive a title from —
  // suggest nothing rather than a vague "…: updates" placeholder. The user types it, or
  // clicks Suggest to draft one from the actual diff.
  if (!plan || (plan.phases.length > 0 && plan.phases.every((phase) => phase.done))) {
    return { title: '', message: '' };
  }
  // Scope is a subsystem area, not the plan id (AGENTS.md: plan's primary tag); plan id goes in Refs: footer.
  const scope = plan.tags?.find((t) => COMMIT_SCOPES.includes(t)) ?? 'repo';
  const kind = plan.kind ?? 'feat';
  const title = `${kind}(${scope}): ${plan.title}`;
  const refs = plan.id ? `Refs: ${plan.id}` : '';
  const phaseBody = plan.phases.length
    ? plan.phases.map((phase) => `- ${phase.text}`).join('\n')
    : '';
  return { title, message: [phaseBody, refs].filter(Boolean).join('\n\n') };
}

function useSelectedFiles(gitStatus: GitStatusEntry[] | null) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const knownPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!gitStatus) return;
    // Snapshot ref before setState: mutating it inside the updater is unsafe under
    // StrictMode's double-invoke, which would empty the file list on the second pass.
    const known = knownPathsRef.current;
    knownPathsRef.current = new Set(gitStatus.map((e) => e.path));
    setSelectedFiles((prev) => {
      const next = new Set<string>();
      for (const entry of gitStatus) {
        if (!known.has(entry.path) || prev.has(entry.path)) next.add(entry.path);
      }
      return next;
    });
  }, [gitStatus]);

  const onToggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return { selectedFiles, onToggleFile };
}

const StatusStamps = () => {
  const statusData = useAppStore((s) => s.status);
  const runCheck = useAppStore((s) => s.runCheck);
  const fixQuality = useAppStore((s) => s.fixQuality);
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const decisions = useAppStore((s) => s.decisions);
  const navigate = useNavigate();
  const [docIssuesExpanded, setDocIssuesExpanded] = useState(false);
  const [viewingDecision, setViewingDecision] = useState<DecisionEntry | null>(null);

  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(statusData),
    [statusData],
  );
  const anyChecksRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
  // `consistency` is doc findings (dangling refs, blocked plans), distinct from consistencyStatus (code check).
  const hasDocIssues = consistency.length > 0;

  const linkedPlanFor = useCallback(
    (issue: ConsistencyIssue) =>
      (issue.kind === 'blocked-plan-active' || issue.kind === 'orphan-subject') && issue.planId
        ? plans?.entries.find((p) => p.id === issue.planId)
        : undefined,
    [plans?.entries],
  );

  const linkedDecisionFor = useCallback(
    (issue: ConsistencyIssue) =>
      issue.kind === 'dangling-superseded-by'
        ? decisions.find((d) => d.title === issue.title)
        : undefined,
    [decisions],
  );

  const handleFindingClick = useCallback(
    (issue: ConsistencyIssue) => {
      const linkedPlan = linkedPlanFor(issue);
      if (linkedPlan) {
        navigate({
          to: '/plans/$planId',
          params: { planId: encodeURIComponent(linkedPlan.title) },
        });
        return;
      }
      const linkedDecision = linkedDecisionFor(issue);
      if (linkedDecision) setViewingDecision(linkedDecision);
    },
    [linkedPlanFor, linkedDecisionFor, navigate],
  );

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
          <span style={{ visibility: opts.status === 'running' ? 'visible' : 'hidden' }}>…</span>
        </Stamp>
      </button>
    </Tooltip>
  );

  return (
    <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: space[3] }}>
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
              hasIssues ? 'Show plan/decision doc findings' : 'No plan/decision doc findings'
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
                  {linkedPlanFor(issue) || linkedDecisionFor(issue) ? (
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
                  ) : (
                    <span style={{ textAlign: 'left' }}>{issue.message}</span>
                  )}
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
          primaryLine = <span style={{ color: chalkStatusText.pass }}>All checks passing.</span>;
        } else {
          primaryLine = (
            <span style={{ color: deskTextMuted, opacity: 0.6 }}>Checks haven't run yet.</span>
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
      <ViewDecisionModal decision={viewingDecision} onClose={() => setViewingDecision(null)} />
    </div>
  );
};

const CommitFileList = ({
  gitStatus,
  expanded,
  onToggleExpanded,
  selectedFiles,
  onToggleFile,
}: {
  gitStatus: GitStatusEntry[];
  expanded: boolean;
  onToggleExpanded: () => void;
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
}) => (
  <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
    <Accordion
      title={`${gitStatus.length} file${gitStatus.length === 1 ? '' : 's'} changed`}
      expanded={expanded}
      onToggle={onToggleExpanded}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: space[2], paddingTop: space[2] }}
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
            {/* Raw checkbox: paper-ui's Checkbox has one label slot (can't fit this
                multi-color mono layout) and its blob/sketch chrome would clash here. */}
            <input
              type="checkbox"
              checked={selectedFiles.has(entry.path)}
              onChange={() => onToggleFile(entry.path)}
              style={{ accentColor: deskChalk }}
            />
            <span style={{ color: entry.staged ? deskChalk : deskTextMuted, minWidth: 24 }}>
              {entry.status}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.path}
            </span>
          </label>
        ))}
      </div>
    </Accordion>
  </div>
);

const CommitForm = ({
  selectedFiles,
  onCommitted,
}: { selectedFiles: Set<string>; onCommitted: () => void }) => {
  const plans = useAppStore((s) => s.plans);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const setCommitInFlight = useAppStore((s) => s.setCommitInFlight);
  const { toast } = useToast();

  // Title is NOT seeded from localStorage — it's re-derived fresh each session from the
  // focus plan (or left empty), so a stale title never resurrects across sessions.
  const [commitTitle, setCommitTitle] = useState('');
  const [commitMessage, setCommitMessage] = useState(() =>
    readStoredCommitField(COMMIT_MESSAGE_STORAGE_KEY),
  );
  const [committing, setCommitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const activePlan = useMemo(() => findFocusPlan(plans?.entries), [plans?.entries]);
  const { title: suggestedTitle, message: suggestedMessage } = useMemo(
    () => deriveSuggestedCommit(activePlan),
    [activePlan],
  );

  useEffect(() => {
    if (suggestedTitle && !commitTitle) setCommitTitle(suggestedTitle);
  }, [suggestedTitle, commitTitle]);

  // A fix-review's suggested commit wins over heuristics/diff suggestions (the agent
  // knows why each change was made). A completed fix-review task keeps its
  // `suggestedCommit` in agentStatus indefinitely, so we only apply one that appears
  // AFTER the form first loads — suggestions already present on mount are from a prior
  // session and must not resurrect a stale title. `staleSuggestionIds === null` until
  // the first non-empty status snapshot, which seeds it with those pre-existing ids.
  const staleSuggestionIds = useRef<Set<string> | null>(null);
  const appliedSuggestionId = useRef<string | null>(null);
  useEffect(() => {
    if (staleSuggestionIds.current === null) {
      if (agentStatus.length === 0) return;
      staleSuggestionIds.current = new Set(
        agentStatus.filter((t) => t.suggestedCommit).map((t) => t.id),
      );
    }
    const task = agentStatus.find(
      (t) => t.suggestedCommit && !staleSuggestionIds.current?.has(t.id),
    );
    if (!task?.suggestedCommit || appliedSuggestionId.current === task.id) return;
    appliedSuggestionId.current = task.id;
    setCommitTitle(task.suggestedCommit.title);
    setCommitMessage(task.suggestedCommit.message);
  }, [agentStatus]);

  useEffect(() => {
    if (suggestedMessage && !commitMessage) setCommitMessage(suggestedMessage);
  }, [suggestedMessage, commitMessage]);

  useEffect(() => {
    writeStoredCommitField(COMMIT_MESSAGE_STORAGE_KEY, commitMessage);
  }, [commitMessage]);

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim() || commitInFlight) return;
    setCommitting(true);
    setCommitInFlight(true);
    try {
      await commitChanges(
        [...selectedFiles],
        commitTitle.trim(),
        commitMessage.trim() || undefined,
      );
      // Clear both to empty — never leave a stale title behind. The suggestion effect
      // re-derives a fresh title if the focus plan still warrants one.
      setCommitTitle('');
      setCommitMessage('');
      onCommitted();
      await loadGitStatus();
    } catch (err) {
      toast({
        title: 'Commit failed',
        description: gitErrorSummary((err as Error).message),
        variant: 'error',
      });
      // A failed commit can leave stale "changed files" behind (e.g. nothing left to
      // commit), which would otherwise invite a doomed retry.
      await loadGitStatus();
    } finally {
      setCommitting(false);
      setCommitInFlight(false);
    }
  }, [
    commitTitle,
    commitMessage,
    selectedFiles,
    loadGitStatus,
    commitInFlight,
    setCommitInFlight,
    onCommitted,
    toast,
  ]);

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

  return (
    <>
      {suggestError && (
        <Alert surface="chalkboard" dismissible onDismiss={() => setSuggestError(null)}>
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
      <Button
        surface="chalkboard"
        size="small"
        fullWidth
        disabled={selectedFiles.size === 0 || !commitTitle.trim() || committing || commitInFlight}
        onClick={handleCommit}
      >
        {committing || commitInFlight ? 'Committing…' : 'Commit'}
      </Button>
    </>
  );
};

const StaleMergedSyncButton = () => {
  const { syncing, gitActionBusy, handleSync } = useBranchSync();
  return (
    // stale-merged: committing here would strand work off main, so dirty
    // sync (stash → main → ff) replaces the commit controls.
    <Button
      surface="chalkboard"
      size="small"
      fullWidth
      icon={<MergeIcon size={14} />}
      disabled={gitActionBusy}
      onClick={handleSync}
    >
      {syncing ? 'Syncing…' : 'Branch merged — sync to main'}
    </Button>
  );
};

const NoChangesActions = ({
  gitAhead,
  gitBranchHygiene,
}: { gitAhead: number; gitBranchHygiene: BranchHygieneStatus | null }) => {
  const { pushing, syncing, pulling, gitActionBusy, handlePush, handleSync, handlePull } =
    useBranchSync();

  if (gitAhead > 0) {
    return (
      <>
        <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>
          All changes committed — {gitAhead} commit{gitAhead === 1 ? '' : 's'} ready to push.
        </p>
        <Button
          surface="chalkboard"
          size="small"
          icon={<PushIcon size={14} />}
          disabled={gitActionBusy}
          onClick={handlePush}
        >
          {pushing ? 'Pushing…' : `Push ${gitAhead} commit${gitAhead === 1 ? '' : 's'}`}
        </Button>
      </>
    );
  }

  return (
    <>
      <p style={{ opacity: 0.5, fontSize: fontSize.xs, margin: 0 }}>No changed files.</p>
      <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
        <Tooltip
          content={gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : undefined}
          surface="chalkboard"
        >
          <Button
            surface="chalkboard"
            size="small"
            icon={<MergeIcon size={14} />}
            disabled={gitActionBusy || gitBranchHygiene === 'clean-on-main'}
            onClick={handleSync}
          >
            {syncing ? 'Syncing…' : 'Sync to main'}
          </Button>
        </Tooltip>
        {/* Pull fast-forwards in place, so unlike Sync it stays enabled on clean main. */}
        <Button
          surface="chalkboard"
          size="small"
          icon={<PullIcon size={14} />}
          disabled={gitActionBusy}
          onClick={handlePull}
        >
          {pulling ? 'Pulling…' : 'Pull'}
        </Button>
      </div>
    </>
  );
};

export const CommitSection = () => {
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const { selectedFiles, onToggleFile } = useSelectedFiles(gitStatus);
  const [commitExpanded, setCommitExpanded] = useState(false);

  return (
    <div
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: space[6],
      }}
    >
      <div style={{ ...sectionLabelStyle, display: 'flex', alignItems: 'center', gap: space[2] }}>
        Deliver
        {gitBranch && (
          <Stamp surface="chalkboard" size="small">
            {gitBranch}
          </Stamp>
        )}
      </div>
      <Card surface="chalkboard" size="small" className="stack-card-fill">
        <StatusStamps />
        {gitStatus && gitStatus.length > 0 ? (
          <>
            <CommitFileList
              gitStatus={gitStatus}
              expanded={commitExpanded}
              onToggleExpanded={() => setCommitExpanded(!commitExpanded)}
              selectedFiles={selectedFiles}
              onToggleFile={onToggleFile}
            />
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: space[3],
                marginTop: space[3],
              }}
            >
              {gitBranchHygiene === 'stale-merged' ? (
                <StaleMergedSyncButton />
              ) : (
                <CommitForm
                  selectedFiles={selectedFiles}
                  onCommitted={() => setCommitExpanded(false)}
                />
              )}
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
            <NoChangesActions gitAhead={gitAhead} gitBranchHygiene={gitBranchHygiene} />
          </div>
        )}
      </Card>
    </div>
  );
};
