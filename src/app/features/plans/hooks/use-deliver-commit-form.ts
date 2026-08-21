import { type CommitFormFile, useCommitForm } from '@/app/hooks/use-commit-form';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import type { AgentTaskState, PlanEntry } from '@/types/index';
import { useCallback, useMemo, useState } from 'react';
import {
  appendManualPhase,
  isCorpusOnlyCommit,
  planEntityPath,
  upsertCheckFixes,
} from '../helpers';
import { usePlanStatusPatch } from './use-plan-status-patch';

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
