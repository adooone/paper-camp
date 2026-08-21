import { GitStashSurface, GitSyncActions } from '@/app/components';
import { entityRouteParam } from '@/app/hooks';
import { type CommitFormFile, useCommitForm } from '@/app/hooks/use-commit-form';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import type { AgentTaskState, CheckStatus, ConsistencyIssue, PlanEntry } from '@/types/index';
import { Button, Stamp, type StampVariant, Tooltip } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import {
  appendManualPhase,
  isCorpusOnlyCommit,
  planEntityPath,
  upsertCheckFixes,
} from '../helpers';
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
  const runConsistencyCheck = useAppStore((s) => s.runConsistencyCheck);
  const { checks: deskChecks, run: runDeskCheck } = useDeskChecks();
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();
  const [docsExpanded, setDocsExpanded] = useState(false);

  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(status, deskChecks),
    [status, deskChecks],
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
    <div className="flex flex-col items-center gap-2">
      {
        // Every check stamp is shown. A single "Health" summary hid the one thing
        // worth reading at a glance — which check is red.
        <div className="flex flex-wrap items-start justify-center gap-2">
          <CheckStamp
            label="Quality"
            status={qualityStatus}
            title="Code style & formatting (Biome lint + format). Click to run."
            anyRunning={anyRunning}
            onClick={() => runDeskCheck('lint')}
          />
          <CheckStamp
            label="Tests"
            status={testStatus}
            title="Unit tests (Vitest). Click to run."
            anyRunning={anyRunning}
            onClick={() => runDeskCheck('test')}
          />
          <CheckStamp
            label="Consistency"
            status={consistencyStatus}
            title="Dead code & architecture (Knip + dependency-cruiser). Click to run."
            anyRunning={anyRunning}
            onClick={() => runConsistencyCheck()}
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
          <GitStashSurface />
        </div>
      }
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

// Layers phase-recording and Fix on the shared commit mechanics — git page's useGitCommitForm has neither.
export const useDeliverCommitForm = (plan: PlanEntry, files: CommitFormFile[]) => {
  const status = useAppStore((s) => s.status);
  const { checks: deskChecks } = useDeskChecks();
  const agentBusy = useAppStore(selectAgentBusy);
  const launchRunAll = useAppStore((s) => s.launchRunAll);
  const { patch: patchByTitle } = usePlanStatusPatch();
  const [fixing, setFixing] = useState(false);

  const { title: suggestedTitle } = useMemo(() => deriveSuggestedCommit(plan), [plan]);
  const filePaths = useMemo(() => files.map((f) => f.path), [files]);

  const beforeCommit = useCallback(
    async (title: string) => {
      // Written before the commit and committed with it: appended afterwards it would
      // leave the entity file dirty, and committing that appends another row, forever.
      if (!plan.id || isCorpusOnlyCommit(filePaths)) return {};
      const planId = plan.id;
      const phaseRecorded = await patchByTitle(plan.title, {
        phases: appendManualPhase(plan.phases, title),
      });
      if (!phaseRecorded) return {};
      return {
        extraPath: planEntityPath(planId),
        // Leaving it would record a phase for a commit that never landed.
        onFailure: async () => {
          await patchByTitle(plan.title, { phases: plan.phases });
        },
      };
    },
    [plan, filePaths, patchByTitle],
  );

  const matchesSuggestionTask = useCallback((t: AgentTaskState) => t.planId === plan.id, [plan.id]);

  const base = useCommitForm(files, {
    formKey: plan.id ?? '__plan-draft__',
    suggestedTitle,
    matchesSuggestionTask,
    beforeCommit,
  });

  const canFix = Boolean(plan.id) && !agentBusy;

  const handleFix = useCallback(async () => {
    if (!plan.id || !status || fixing || agentBusy) return;
    const planId = plan.id;
    setFixing(true);
    try {
      const nextFixes = upsertCheckFixes(plan.fixes ?? [], status, deskChecks);
      const wrote = await patchByTitle(plan.title, { fixes: nextFixes });
      if (wrote) await launchRunAll(planId);
    } finally {
      setFixing(false);
    }
  }, [plan, fixing, agentBusy, status, deskChecks, patchByTitle, launchRunAll]);

  return {
    ...base,
    canFix,
    fixing,
    handleFix,
  };
};

export type DeliverCommitFormState = ReturnType<typeof useDeliverCommitForm>;

// Becomes Fix on a failing check — a plan always exists here, unlike the git page's GitCommitButton.
export const DeliverCommitButton = ({
  state,
  filesEmpty,
}: {
  state: DeliverCommitFormState;
  filesEmpty: boolean;
}) => {
  const status = useAppStore((s) => s.status);
  const { checks: deskChecks } = useDeskChecks();
  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(status, deskChecks),
    [status, deskChecks],
  );
  const checksFailing =
    qualityStatus === 'fail' || testStatus === 'fail' || consistencyStatus === 'fail';

  if (checksFailing) {
    const label = state.fixing ? 'Fixing…' : 'Fix';
    return (
      <CommitActionButton
        label={label}
        disabled={!state.canFix || state.fixing}
        onClick={state.handleFix}
      />
    );
  }

  const committing = state.committing || state.commitInFlight;
  const label = committing
    ? 'Committing…'
    : state.stagedCount > 0
      ? `Commit ${state.stagedCount} staged`
      : 'Commit';

  return (
    <CommitActionButton
      label={label}
      disabled={filesEmpty || !state.commitTitle.trim() || committing}
      onClick={state.handleCommit}
    />
  );
};

const CommitActionButton = ({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) => (
  <Button size="small" disabled={disabled} onClick={onClick}>
    {label}
  </Button>
);

export const DeliverEmptyState = () => {
  const gitAhead = useAppStore((s) => s.gitAhead);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="m-0 text-center text-xs opacity-50">
        {gitAhead > 0
          ? `All changes committed — ${gitAhead} commit${gitAhead === 1 ? '' : 's'} ready to push.`
          : 'No changed files.'}
      </p>
      <GitSyncActions />
    </div>
  );
};
