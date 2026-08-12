import { MergeIcon, PullIcon, PushIcon, WandIcon } from '@/app/components/icons';
import { entityRouteParam } from '@/app/hooks';
import { useBranchSync } from '@/app/hooks/use-branch-sync';
import { commitChanges, suggestCommitMessage } from '@/app/services/git-api';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { CheckStatus, ConsistencyIssue, PlanEntry } from '@/types/index';
import {
  Alert,
  Button,
  IconButton,
  Input,
  Stamp,
  type StampVariant,
  Tooltip,
  useToast,
} from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appendManualPhase, upsertCheckFixes } from '../helpers';
import { usePlanStatusPatch } from '../hooks';

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
  if (!plan || (plan.phases.length > 0 && plan.phases.every((phase) => phase.done))) {
    return { title: '' };
  }
  const scope = plan.tags?.find((t) => COMMIT_SCOPES.includes(t)) ?? 'repo';
  const kind = plan.kind ?? 'feat';
  return { title: `${kind}(${scope}): ${plan.title}` };
}

const CHECK_VARIANT: Record<CheckStatus, StampVariant> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

const CheckStamp = ({
  label,
  status,
  title,
  anyRunning,
  onClick,
}: {
  label: string;
  status: CheckStatus;
  title: string;
  anyRunning: boolean;
  onClick: () => void;
}) => (
  <Tooltip content={title}>
    {/* Raw <button>: the clickable target is a Stamp, so it needs a chrome-less wrapper. */}
    <button
      type="button"
      className={`inline-flex bg-none bg-transparent border-none p-0 enabled:hover:-translate-y-px enabled:hover:brightness-[1.15] enabled:active:translate-y-0 enabled:active:brightness-[0.95] ${anyRunning ? 'cursor-not-allowed' : 'cursor-pointer'} ${anyRunning && status !== 'running' ? 'opacity-50' : 'opacity-100'}`}
      onClick={() => {
        if (!anyRunning) onClick();
      }}
      disabled={anyRunning}
    >
      <Stamp size="small" variant={CHECK_VARIANT[status]}>
        {label}
        <span className={status === 'running' ? 'visible' : 'invisible'}>…</span>
      </Stamp>
    </button>
  </Tooltip>
);

export const DeliverChecksRow = () => {
  const status = useAppStore((s) => s.status);
  const runCheck = useAppStore((s) => s.runCheck);
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();
  const [docsExpanded, setDocsExpanded] = useState(false);

  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(status),
    [status],
  );
  const anyRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
  const hasDocIssues = consistency.length > 0;

  const linkedPlanFor = useCallback(
    (issue: ConsistencyIssue) =>
      issue.planId ? plans?.entries.find((p) => p.id === issue.planId) : undefined,
    [plans?.entries],
  );

  return (
    <div className="flex flex-wrap items-start gap-2">
      <CheckStamp
        label="Quality"
        status={qualityStatus}
        title="Code style & formatting (Biome lint + format). Click to run."
        anyRunning={anyRunning}
        onClick={() => {
          runCheck('lint');
          runCheck('format');
        }}
      />
      <CheckStamp
        label="Tests"
        status={testStatus}
        title="Unit tests (Vitest). Click to run."
        anyRunning={anyRunning}
        onClick={() => runCheck('test')}
      />
      <CheckStamp
        label="Consistency"
        status={consistencyStatus}
        title="Dead code & architecture (Knip + dependency-cruiser). Click to run."
        anyRunning={anyRunning}
        onClick={() => runCheck('consistency')}
      />
      <div>
        <Tooltip
          content={
            hasDocIssues
              ? 'Plan/idea doc findings — orphan subjects, title style & stale references. Click to show.'
              : 'Plan/idea docs — no findings (orphan subjects, title style, stale references).'
          }
        >
          {/* Raw <button>: the clickable target is a Stamp, so it needs a chrome-less wrapper. */}
          <button
            type="button"
            className={`inline-flex bg-none bg-transparent border-none p-0 ${hasDocIssues ? 'enabled:hover:-translate-y-px enabled:hover:brightness-[1.15] enabled:active:translate-y-0 enabled:active:brightness-[0.95] cursor-pointer' : 'cursor-default'}`}
            disabled={!hasDocIssues}
            aria-expanded={hasDocIssues ? docsExpanded : undefined}
            aria-controls="deliver-doc-findings"
            onClick={() => {
              if (hasDocIssues) setDocsExpanded((prev) => !prev);
            }}
          >
            <Stamp size="small" variant={hasDocIssues ? 'error' : 'success'}>
              Docs
            </Stamp>
          </button>
        </Tooltip>
        {docsExpanded && hasDocIssues && (
          <div id="deliver-doc-findings" className="mt-2 flex flex-col gap-2">
            {consistency.map((issue, i) => {
              const linkedPlan = linkedPlanFor(issue);
              return (
                <div
                  key={`${issue.kind}-${issue.title}-${i}`}
                  className="font-mono text-2xs opacity-70"
                >
                  {linkedPlan ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/plans/$planId',
                          params: {
                            planId: entityRouteParam(linkedPlan.id, linkedPlan.title),
                          },
                        })
                      }
                      className="bg-none bg-transparent border-none p-0 underline cursor-pointer [font:inherit] text-left"
                    >
                      {issue.message}
                    </button>
                  ) : (
                    <span className="text-left">{issue.message}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const DeliverChangedFiles = ({ count }: { count: number }) => {
  const navigate = useNavigate();
  return (
    // Raw <button>: paper-ui Button has no inline-underlined link style.
    <button
      type="button"
      onClick={() => navigate({ to: '/git' })}
      className="bg-none bg-transparent border-none p-0 font-handwritten text-xs opacity-[0.6] underline cursor-pointer"
    >
      {count} file{count === 1 ? '' : 's'} changed
    </button>
  );
};

/** Shared state/handlers for the split commit input row (left column) and
 *  Commit button (right column) — both need the same title/in-flight state. */
export const useDeliverCommitForm = (plan: PlanEntry | undefined, files: string[]) => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const setCommitInFlight = useAppStore((s) => s.setCommitInFlight);
  const status = useAppStore((s) => s.status);
  const agentBusy = useAppStore(selectAgentBusy);
  const launchRunAll = useAppStore((s) => s.launchRunAll);
  const { patch: patchByTitle } = usePlanStatusPatch();
  const { toast } = useToast();

  const [commitTitle, setCommitTitle] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  const { title: suggestedTitle } = useMemo(() => deriveSuggestedCommit(plan), [plan]);

  useEffect(() => {
    if (suggestedTitle && !commitTitle) setCommitTitle(suggestedTitle);
  }, [suggestedTitle, commitTitle]);

  const staleSuggestionIds = useRef<Set<string> | null>(null);
  const appliedSuggestionId = useRef<string | null>(null);
  useEffect(() => {
    if (!plan) return;
    if (staleSuggestionIds.current === null) {
      if (agentStatus.length === 0) return;
      staleSuggestionIds.current = new Set(
        agentStatus.filter((t) => t.suggestedCommit).map((t) => t.id),
      );
    }
    const task = agentStatus.find(
      (t) => t.planId === plan.id && t.suggestedCommit && !staleSuggestionIds.current?.has(t.id),
    );
    if (!task?.suggestedCommit || appliedSuggestionId.current === task.id) return;
    appliedSuggestionId.current = task.id;
    setCommitTitle(task.suggestedCommit.title);
    setCommitMessage(task.suggestedCommit.message);
  }, [agentStatus, plan]);

  const handleCommit = useCallback(async () => {
    if (!commitTitle.trim() || commitInFlight) return;
    setCommitting(true);
    setCommitInFlight(true);
    try {
      await commitChanges(files, commitTitle.trim(), commitMessage.trim() || undefined);
      if (plan) {
        await patchByTitle(plan.title, {
          phases: appendManualPhase(plan.phases, commitTitle.trim()),
        });
      }
      setCommitTitle('');
      setCommitMessage('');
      await loadGitStatus();
    } catch (err) {
      toast({
        title: 'Commit failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
      await loadGitStatus();
    } finally {
      setCommitting(false);
      setCommitInFlight(false);
    }
  }, [
    commitTitle,
    commitMessage,
    files,
    loadGitStatus,
    commitInFlight,
    setCommitInFlight,
    toast,
    plan,
    patchByTitle,
  ]);

  const handleSuggestFromChanges = useCallback(async () => {
    if (files.length === 0) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestCommitMessage(files);
      setCommitTitle(result.title);
      setCommitMessage(result.message);
    } catch (err) {
      setSuggestError((err as Error).message);
    } finally {
      setSuggesting(false);
    }
  }, [files]);

  const canFix = Boolean(plan?.id) && !agentBusy;

  const handleFix = useCallback(async () => {
    if (!plan?.id || !status || fixing || agentBusy) return;
    setFixing(true);
    try {
      const nextFixes = upsertCheckFixes(plan.fixes ?? [], status);
      const wrote = await patchByTitle(plan.title, { fixes: nextFixes });
      if (wrote) await launchRunAll(plan.id);
    } finally {
      setFixing(false);
    }
  }, [plan, fixing, agentBusy, status, patchByTitle, launchRunAll]);

  return {
    commitTitle,
    setCommitTitle,
    committing,
    commitInFlight,
    suggesting,
    suggestError,
    setSuggestError,
    handleCommit,
    handleSuggestFromChanges,
    canFix,
    fixing,
    handleFix,
  };
};

export type DeliverCommitFormState = ReturnType<typeof useDeliverCommitForm>;

/** Left column, under the check stamps: title input + suggest-from-diff. */
export const DeliverCommitInputRow = ({
  state,
  filesEmpty,
}: {
  state: DeliverCommitFormState;
  filesEmpty: boolean;
}) => (
  <div className="flex flex-col gap-2">
    {state.suggestError && (
      <Alert dismissible onDismiss={() => state.setSuggestError(null)}>
        {state.suggestError}
      </Alert>
    )}
    <div className="flex gap-2 items-center">
      <div className="flex-1">
        <Input
          size="small"
          placeholder="Commit title"
          value={state.commitTitle}
          onChange={(e) => state.setCommitTitle(e.currentTarget.value)}
        />
      </div>
      <IconButton
        icon={<WandIcon size={16} />}
        size="small"
        label="Suggest title and message from the diff"
        disabled={filesEmpty || state.suggesting}
        onClick={state.handleSuggestFromChanges}
        wobble={state.suggesting ? 1 : 0}
      />
    </div>
  </div>
);

/** Right column, under "N files changed": the Commit action itself — becomes a
 *  Fix action while any of Quality/Tests/Consistency is failing (IDEA-156). */
export const DeliverCommitButton = ({
  state,
  filesEmpty,
}: {
  state: DeliverCommitFormState;
  filesEmpty: boolean;
}) => {
  const status = useAppStore((s) => s.status);
  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(status),
    [status],
  );
  const checksFailing =
    qualityStatus === 'fail' || testStatus === 'fail' || consistencyStatus === 'fail';

  if (checksFailing) {
    return (
      <Button size="small" disabled={!state.canFix || state.fixing} onClick={state.handleFix}>
        {state.fixing ? 'Fixing…' : 'Fix'}
      </Button>
    );
  }

  return (
    <Button
      size="small"
      disabled={filesEmpty || !state.commitTitle.trim() || state.committing || state.commitInFlight}
      onClick={state.handleCommit}
    >
      {state.committing || state.commitInFlight ? 'Committing…' : 'Commit'}
    </Button>
  );
};

export const DeliverEmptyState = () => {
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const { pushing, syncing, pulling, gitActionBusy, handlePush, handleSync, handlePull } =
    useBranchSync();

  if (gitAhead > 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 text-xs opacity-50">
          All changes committed — {gitAhead} commit{gitAhead === 1 ? '' : 's'} ready to push.
        </p>
        <Button
          size="small"
          icon={<PushIcon size={14} />}
          disabled={gitActionBusy}
          onClick={handlePush}
        >
          {pushing ? 'Pushing…' : `Push ${gitAhead} commit${gitAhead === 1 ? '' : 's'}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="m-0 text-xs opacity-50">No changed files.</p>
      <div className="flex items-center gap-2">
        <Tooltip
          content={gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : undefined}
        >
          <Button
            size="small"
            icon={<MergeIcon size={14} />}
            disabled={gitActionBusy || gitBranchHygiene === 'clean-on-main'}
            onClick={handleSync}
          >
            {syncing ? 'Syncing…' : 'Sync to main'}
          </Button>
        </Tooltip>
        <Button
          size="small"
          icon={<PullIcon size={14} />}
          disabled={gitActionBusy}
          onClick={handlePull}
        >
          {pulling ? 'Pulling…' : 'Pull'}
        </Button>
      </div>
    </div>
  );
};
