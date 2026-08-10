import { findFocusPlan } from '@/app/features/plans/helpers';
import { useBranchSync } from '@/app/hooks/use-branch-sync';
import { commitChanges, suggestCommitMessage } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { summarizeQualityFailure, summarizeTestFailure } from '@/app/utils/check-summary';
import type { BranchHygieneStatus, CheckStatus, ConsistencyIssue, PlanEntry } from '@/types/index';
import {
  Alert,
  Button,
  Card,
  CopyButton,
  IconButton,
  Input,
  Stamp,
  Tooltip,
  useToast,
} from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MergeIcon, PullIcon, PushIcon, WandIcon } from '../icons';
import { chalkStatusFill, chalkStatusText, gitErrorSummary, sectionLabelClassName } from './shared';

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

function deriveSuggestedCommit(plan: PlanEntry | undefined): { title: string } {
  // A finished plan (every phase done) has nothing meaningful to derive a title from —
  // suggest nothing rather than a vague "…: updates" placeholder. The user types it, or
  // clicks Suggest to draft one from the actual diff.
  if (!plan || (plan.phases.length > 0 && plan.phases.every((phase) => phase.done))) {
    return { title: '' };
  }
  // Scope is a subsystem area, not the plan id (AGENTS.md: plan's primary tag); plan id goes in Refs: footer.
  const scope = plan.tags?.find((t) => COMMIT_SCOPES.includes(t)) ?? 'repo';
  const kind = plan.kind ?? 'feat';
  const title = `${kind}(${scope}): ${plan.title}`;
  return { title };
}

const StatusStamps = () => {
  const statusData = useAppStore((s) => s.status);
  const runCheck = useAppStore((s) => s.runCheck);
  const fixQuality = useAppStore((s) => s.fixQuality);
  const consistency = useAppStore((s) => s.consistency);
  const doctor = useAppStore((s) => s.doctor);
  const plans = useAppStore((s) => s.plans);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBehind = useAppStore((s) => s.gitBehind);
  const gitDiverged = useAppStore((s) => s.gitDiverged);
  const navigate = useNavigate();
  const [docIssuesExpanded, setDocIssuesExpanded] = useState(false);
  const [doctorExpanded, setDoctorExpanded] = useState(false);
  const { fixingDivergence, gitActionBusy, handleFixDivergence } = useBranchSync();

  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(statusData),
    [statusData],
  );
  const anyChecksRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
  // `consistency` is doc findings (orphan subjects), distinct from consistencyStatus (code check).
  const hasDocIssues = consistency.length > 0;
  // `doctor` is corpus-structure findings (paper-camp doctor), distinct from both above.
  const hasDoctorFindings = doctor.findings.length > 0;

  const linkedPlanFor = useCallback(
    (issue: ConsistencyIssue) =>
      issue.planId ? plans?.entries.find((p) => p.id === issue.planId) : undefined,
    [plans?.entries],
  );

  const handleFindingClick = useCallback(
    (issue: ConsistencyIssue) => {
      const linkedPlan = linkedPlanFor(issue);
      if (linkedPlan) {
        navigate({
          to: '/plans/$planId',
          params: { planId: encodeURIComponent(linkedPlan.title) },
        });
      }
    },
    [linkedPlanFor, navigate],
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
        className={`inline-flex bg-none bg-transparent border-none p-0 enabled:hover:-translate-y-px enabled:hover:brightness-[1.15] enabled:active:translate-y-0 enabled:active:brightness-[0.95] ${anyRunning ? 'cursor-not-allowed' : 'cursor-pointer'} ${anyRunning && opts.status !== 'running' ? 'opacity-50' : 'opacity-100'}`}
        onClick={() => {
          if (!anyRunning) opts.onClick();
        }}
        disabled={anyRunning}
      >
        <Stamp
          surface="chalkboard"
          size="small"
          fillColor={statusFill[opts.status]}
          textColor={statusText[opts.status]}
        >
          {opts.label}
          <span className={opts.status === 'running' ? 'visible' : 'invisible'}>…</span>
        </Stamp>
      </button>
    </Tooltip>
  );

  return (
    <div className="flex-none flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap justify-center">
        {checkButton({
          label: 'Quality',
          status: qualityStatus,
          title: 'Code style & formatting (Biome lint + format). Click to run.',
          onClick: () => {
            runCheck('lint');
            runCheck('format');
          },
        })}
        {checkButton({
          label: 'Tests',
          status: testStatus,
          title: 'Unit tests (Vitest). Click to run.',
          onClick: () => runCheck('test'),
        })}
        {checkButton({
          label: 'Consistency',
          status: consistencyStatus,
          title: 'Dead code & architecture (Knip + dependency-cruiser). Click to run.',
          onClick: () => runCheck('consistency'),
        })}
        <div>
          <Tooltip
            content={
              hasIssues
                ? 'Plan/idea doc findings — orphan subjects, title style & stale references. Click to show.'
                : 'Plan/idea docs — no findings (orphan subjects, title style, stale references).'
            }
            surface="chalkboard"
          >
            <button
              type="button"
              className={`inline-flex bg-none bg-transparent border-none p-0 ${hasIssues ? 'enabled:hover:-translate-y-px enabled:hover:brightness-[1.15] enabled:active:translate-y-0 enabled:active:brightness-[0.95] cursor-pointer' : 'cursor-default'}`}
              disabled={!hasIssues}
              aria-expanded={hasIssues ? docIssuesExpanded : undefined}
              aria-controls="stack-doc-findings"
              onClick={() => {
                if (hasIssues) setDocIssuesExpanded((prev) => !prev);
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
            <div id="stack-doc-findings" className="mt-2 flex flex-col gap-2">
              {consistency.map((issue, i) => (
                <div
                  key={`${issue.kind}-${issue.title}-${i}`}
                  className="font-mono text-2xs text-desk-text-muted"
                >
                  {linkedPlanFor(issue) ? (
                    <button
                      type="button"
                      onClick={() => handleFindingClick(issue)}
                      className="bg-none bg-transparent border-none p-0 text-desk-chalk underline cursor-pointer [font:inherit] text-left"
                    >
                      {issue.message}
                    </button>
                  ) : (
                    <span className="text-left">{issue.message}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <Tooltip
            content={
              hasDoctorFindings
                ? 'Corpus structure findings (paper-camp doctor) — frontmatter, ids, phases lists, archive placement, dangling links. Click to show.'
                : 'Corpus structure (paper-camp doctor) — no findings.'
            }
            surface="chalkboard"
          >
            <button
              type="button"
              className={`inline-flex bg-none bg-transparent border-none p-0 ${hasDoctorFindings ? 'enabled:hover:-translate-y-px enabled:hover:brightness-[1.15] enabled:active:translate-y-0 enabled:active:brightness-[0.95] cursor-pointer' : 'cursor-default'}`}
              disabled={!hasDoctorFindings}
              aria-expanded={hasDoctorFindings ? doctorExpanded : undefined}
              aria-controls="stack-doctor-findings"
              onClick={() => {
                if (hasDoctorFindings) setDoctorExpanded((prev) => !prev);
              }}
            >
              <Stamp
                surface="chalkboard"
                size="small"
                fillColor={
                  doctor.errorCount > 0
                    ? chalkStatusFill.fail
                    : doctor.warningCount > 0
                      ? chalkStatusFill.running
                      : chalkStatusFill.pass
                }
                textColor={
                  doctor.errorCount > 0
                    ? chalkStatusText.fail
                    : doctor.warningCount > 0
                      ? chalkStatusText.running
                      : chalkStatusText.pass
                }
              >
                Doctor
              </Stamp>
            </button>
          </Tooltip>
          {doctorExpanded && hasDoctorFindings && (
            <div id="stack-doctor-findings" className="mt-2 flex flex-col gap-2">
              {doctor.findings.map((finding, i) => (
                <div
                  key={`${finding.file}-${finding.line}-${finding.rule}-${i}`}
                  className="font-mono text-2xs text-desk-text-muted text-left"
                >
                  <span
                    className={
                      finding.severity === 'error'
                        ? 'text-chalk-fail-text'
                        : 'text-chalk-running-text'
                    }
                  >
                    {finding.severity}
                  </span>{' '}
                  {finding.file}:{finding.line} — {finding.rule}: {finding.message}
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
          primaryLine = <span className="text-desk-text-muted">Running checks…</span>;
        } else if (gitDiverged) {
          primaryLine = (
            <span className="text-desk-text-muted">
              {gitBranch} has diverged from origin ({gitAhead} local, {gitBehind} remote)
            </span>
          );
          secondaryLine = (
            // Raw <button>: Button has no inline-underlined link style; matches the
            // identical pattern already used for the doc-findings/quality-fix links below.
            <button
              type="button"
              onClick={handleFixDivergence}
              disabled={gitActionBusy}
              className="bg-none bg-transparent border-none p-0 text-desk-chalk underline cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 [font:inherit]"
            >
              {fixingDivergence ? 'Fixing…' : 'Suggested fix: Fix git issues'}
            </button>
          );
        } else if (qualityStatus === 'fail') {
          primaryLine = (
            <span className="text-desk-text-muted">
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
              className="bg-none bg-transparent border-none p-0 text-desk-chalk underline cursor-pointer [font:inherit]"
            >
              Suggested fix: run biome --write
            </button>
          );
        } else if (testStatus === 'fail') {
          primaryLine = (
            <span className="text-desk-text-muted">
              {summarizeTestFailure(statusData?.test?.output ?? '')}
            </span>
          );
          secondaryLine = (
            <span className="text-desk-chalk">
              Suggested fix: <CopyButton text={testFixPrompt} surface="chalkboard" />
            </span>
          );
        } else if (consistencyStatus === 'fail') {
          primaryLine = (
            <span className="text-desk-text-muted">
              Codebase consistency failed (knip / dependency-cruiser).
            </span>
          );
          secondaryLine = (
            <span className="text-desk-text-muted opacity-80">
              Run pnpm run consistency for details.
            </span>
          );
        } else if (hasDocIssues) {
          primaryLine = (
            <span className="text-desk-text-muted">Plan doc issues — see the Docs stamp.</span>
          );
        } else if (
          qualityStatus === 'pass' &&
          testStatus === 'pass' &&
          consistencyStatus === 'pass'
        ) {
          primaryLine = <span className="text-chalk-pass-text">All checks passing.</span>;
        } else {
          primaryLine = (
            <span className="text-desk-text-muted opacity-60">Checks haven't run yet.</span>
          );
        }
        return (
          <div className="text-center flex flex-col gap-1 font-handwritten text-sm">
            {primaryLine}
            <span className={secondaryLine ? 'visible' : 'invisible'}>{secondaryLine ?? ' '}</span>
          </div>
        );
      })()}
    </div>
  );
};

interface ChangedFilesCountProps {
  count: number;
}

const ChangedFilesCount = ({ count }: ChangedFilesCountProps) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/diff' })}
      className="block mx-auto bg-none bg-transparent border-none p-0 text-center font-mono text-xs text-desk-text-muted underline cursor-pointer"
    >
      {count} file{count === 1 ? '' : 's'} changed
    </button>
  );
};

const CommitForm = ({ files }: { files: string[] }) => {
  const plans = useAppStore((s) => s.plans);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const setCommitInFlight = useAppStore((s) => s.setCommitInFlight);
  const { toast } = useToast();

  // Title is NOT seeded from localStorage — it's re-derived fresh each session from the
  // focus plan (or left empty), so a stale title never resurrects across sessions.
  const [commitTitle, setCommitTitle] = useState('');
  const [committing, setCommitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const activePlan = useMemo(() => findFocusPlan(plans?.entries), [plans?.entries]);
  const { title: suggestedTitle } = useMemo(() => deriveSuggestedCommit(activePlan), [activePlan]);

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
  }, [agentStatus]);

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim() || commitInFlight) return;
    setCommitting(true);
    setCommitInFlight(true);
    try {
      await commitChanges(files, commitTitle.trim());
      // Clear to empty — never leave a stale title behind. The suggestion effect
      // re-derives a fresh title if the focus plan still warrants one.
      setCommitTitle('');
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
  }, [commitTitle, files, loadGitStatus, commitInFlight, setCommitInFlight, toast]);

  const handleSuggestFromChanges = useCallback(async () => {
    if (files.length === 0) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestCommitMessage(files);
      setCommitTitle(result.title);
    } catch (err) {
      setSuggestError((err as Error).message);
    } finally {
      setSuggesting(false);
    }
  }, [files]);

  return (
    <>
      {suggestError && (
        <Alert surface="chalkboard" dismissible onDismiss={() => setSuggestError(null)}>
          {suggestError}
        </Alert>
      )}
      <div className="flex gap-2 items-center">
        <div className="flex-1">
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
          disabled={files.length === 0 || suggesting}
          onClick={handleSuggestFromChanges}
          wobble={suggesting ? 1 : 0}
        />
      </div>
      <Button
        surface="chalkboard"
        size="small"
        fullWidth
        disabled={files.length === 0 || !commitTitle.trim() || committing || commitInFlight}
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
        <p className="opacity-50 text-xs m-0">
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
      <p className="opacity-50 text-xs m-0">No changed files.</p>
      <div className="flex gap-2 items-center">
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
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const files = useMemo(() => gitStatus?.map((entry) => entry.path) ?? [], [gitStatus]);

  return (
    <div className="flex-none flex flex-col p-6">
      <div className={sectionLabelClassName}>Deliver</div>
      <Card surface="chalkboard" size="small">
        <StatusStamps />
        {gitStatus && gitStatus.length > 0 ? (
          <>
            <ChangedFilesCount count={gitStatus.length} />
            <div className="flex-shrink-0 flex flex-col gap-3 mt-3">
              {gitBranchHygiene === 'stale-merged' ? (
                <StaleMergedSyncButton />
              ) : (
                <CommitForm files={files} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
            <NoChangesActions gitAhead={gitAhead} gitBranchHygiene={gitBranchHygiene} />
          </div>
        )}
      </Card>
    </div>
  );
};
