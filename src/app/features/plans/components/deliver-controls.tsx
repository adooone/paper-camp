import { MergeIcon, PullIcon, PushIcon, WandIcon } from '@/app/components/icons';
import { useBranchSync } from '@/app/hooks/use-branch-sync';
import { commitChanges, suggestCommitMessage } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
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

function deriveSuggestedCommit(plan: PlanEntry): { title: string } {
  if (plan.phases.length > 0 && plan.phases.every((phase) => phase.done)) {
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
    <div className="flex items-start gap-2">
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
                          params: { planId: encodeURIComponent(linkedPlan.title) },
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
      onClick={() => navigate({ to: '/diff' })}
      className="self-start bg-none bg-transparent border-none p-0 font-mono text-xs opacity-[0.6] underline cursor-pointer"
    >
      {count} file{count === 1 ? '' : 's'} changed
    </button>
  );
};

export const DeliverCommitForm = ({ plan, files }: { plan: PlanEntry; files: string[] }) => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const setCommitInFlight = useAppStore((s) => s.setCommitInFlight);
  const { toast } = useToast();

  const [commitTitle, setCommitTitle] = useState('');
  const [committing, setCommitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const { title: suggestedTitle } = useMemo(() => deriveSuggestedCommit(plan), [plan]);

  useEffect(() => {
    if (suggestedTitle && !commitTitle) setCommitTitle(suggestedTitle);
  }, [suggestedTitle, commitTitle]);

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
      setCommitTitle('');
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
    <div className="flex flex-col gap-2">
      {suggestError && (
        <Alert dismissible onDismiss={() => setSuggestError(null)}>
          {suggestError}
        </Alert>
      )}
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <Input
            size="small"
            placeholder="Commit title"
            value={commitTitle}
            onChange={(e) => setCommitTitle(e.currentTarget.value)}
          />
        </div>
        <IconButton
          icon={<WandIcon size={16} />}
          size="small"
          label="Suggest title and message from the diff"
          disabled={files.length === 0 || suggesting}
          onClick={handleSuggestFromChanges}
          wobble={suggesting ? 1 : 0}
        />
      </div>
      <Button
        size="small"
        disabled={files.length === 0 || !commitTitle.trim() || committing || commitInFlight}
        onClick={handleCommit}
      >
        {committing || commitInFlight ? 'Committing…' : 'Commit'}
      </Button>
    </div>
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
