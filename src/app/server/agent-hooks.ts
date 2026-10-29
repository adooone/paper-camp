import { resolvePrimaryScope } from '@/core/git-pr';
import { mergeRun } from '@/core/phase-run';
import { computePlanContentHash } from '@/core/serialize';
import { todayDateString } from '@/core/serialize';
import type {
  CheckName,
  GitStatusEntry,
  GitSyncResult,
  PhaseItem,
  PlanEntry,
  RunUsage,
} from '@/types/index';
import { runBiomeFix } from './biome-fix';
import type { GitManager } from './git';
import { CorpusError, checkStaleBaseForRunAll, updateEntity } from './helpers';

function resolveCommitScope(plan: Pick<PlanEntry, 'tags'>): string {
  return resolvePrimaryScope(plan.tags, 'plans');
}

// Kept out of api.ts so the middleware only wires managers together.
export function createAgentHooks(root: string, git: GitManager) {
  // Batch audit can touch archived (done/dropped) entities too — updateEntity
  // resolves either location, so those get stamped instead of re-audited every run.
  async function stampAuditDate(planId: string): Promise<void> {
    try {
      await updateEntity(root, planId, (entry) => ({
        audited: todayDateString(),
        auditedHash: computePlanContentHash({ body: entry.body, phases: entry.phases }),
      }));
    } catch (error) {
      if (error instanceof CorpusError) return;
      throw error;
    }
  }

  async function annotatePhaseRun(
    planId: string,
    phaseIndex: number,
    run: { usage: RunUsage; kind: 'phase' | 'fix'; sessionId?: string },
  ): Promise<void> {
    const key = run.kind === 'fix' ? 'fixes' : 'phases';
    try {
      await updateEntity(root, planId, (entry) => {
        const list = entry[key];
        const target = list?.[phaseIndex];
        if (!target) return undefined;
        return {
          [key]: list.map((item, i) =>
            i === phaseIndex
              ? { ...item, run: mergeRun(item.run, run.usage, run.sessionId) }
              : item,
          ),
        };
      });
    } catch (error) {
      if (error instanceof CorpusError) return;
      throw error;
    }
  }

  function snapshotWorkingTree(): Promise<GitStatusEntry[]> {
    return git.getStatus();
  }

  // Fetch and fast-forward (or reconcile) before a phase/run-all task starts, so
  // no agent builds on a base that's days behind (IDEA-319).
  function ensureUpToDate(): Promise<GitSyncResult> {
    return git.fixDivergence();
  }

  function changedSince(start: GitStatusEntry[], end: GitStatusEntry[]): string[] {
    const startStatusByPath = new Map(start.map((entry) => [entry.path, entry.status]));
    const changed = end.filter((entry) => startStatusByPath.get(entry.path) !== entry.status);
    return changed.map((entry) => entry.path);
  }

  async function commitPhase(
    plan: PlanEntry,
    phase: PhaseItem,
    phaseIndex: number,
    startSnapshot: GitStatusEntry[],
    run?: { usage: RunUsage; kind: 'phase' | 'fix'; sessionId?: string },
  ): Promise<void> {
    if (run && plan.id) await annotatePhaseRun(plan.id, phaseIndex, run);
    const area = resolveCommitScope(plan);
    const title = `${plan.kind ?? 'feat'}(${area}): ${phase.text}`;
    const refs = plan.id ? `Refs: ${plan.id}` : undefined;
    await runBiomeFix(root);
    const files = changedSince(startSnapshot, await git.getStatus());
    if (files.length === 0) return;
    // noVerify: this is a machine-generated commit; the message is valid by
    // construction, so the commit-msg hook must not block an unattended run.
    await git.commit(files, title, refs, { noVerify: true });
  }

  // The one commit for the run's end-of-run verify+fix pass (IDEA-255) — runs even
  // when no fix attempt was needed, since the sweep's biome fixer can still reformat.
  async function commitVerifyFix(
    plan: PlanEntry,
    checkNames: CheckName[],
    startSnapshot: GitStatusEntry[],
  ): Promise<void> {
    const area = resolveCommitScope(plan);
    const title =
      checkNames.length > 0 ? `fix(${area}): ${checkNames.join(', ')}` : `style(${area}): format`;
    const refs = plan.id ? `Refs: ${plan.id}` : undefined;
    const files = changedSince(startSnapshot, await git.getStatus());
    if (files.length === 0) return;
    await git.commit(files, title, refs, { noVerify: true });
  }

  async function setRunReview(plan: PlanEntry): Promise<void> {
    if (!plan.id) return;
    let wasAlreadyClosed = false;
    try {
      await updateEntity(root, plan.id, (entry) => {
        if (entry.status === 'review' || entry.status === 'done' || entry.status === 'dropped') {
          wasAlreadyClosed = true;
          return undefined;
        }
        return { status: 'review' };
      });
    } catch (error) {
      if (error instanceof CorpusError) return;
      throw error;
    }
    if (wasAlreadyClosed) return;
    const refs = plan.id ? `Refs: ${plan.id}` : undefined;
    await git.stageAll();
    await git.commit([], `docs(ideas): mark ${plan.id} review`, refs, {
      noVerify: true,
    });
  }

  async function commitCorpus(plan: PlanEntry): Promise<void> {
    if (!plan.id) return;
    await git.commitCorpus(`docs(ideas): ${plan.title} — plan`, plan.id);
  }

  // Catches whatever a run's own commits didn't ride on, in one commit per run
  // instead of trickling out one commit per write (IDEA-319).
  async function commitBookkeeping(plan: Pick<PlanEntry, 'id' | 'title'>): Promise<void> {
    await git.stageAll();
    if ((await git.getStatus()).length === 0) return;
    const refs = plan.id ? `Refs: ${plan.id}` : undefined;
    await git.commit([], `docs(ideas): ${plan.id ?? plan.title} run bookkeeping`, refs, {
      noVerify: true,
    });
  }

  // After a resolve-conflict agent exits, the repo state decides success, not the
  // agent's own exit code — an aborted rebase can still exit 0 (IDEA-319).
  async function settleResolveConflict(): Promise<{ ok: true } | { ok: false; reason: string }> {
    const outcome = await git.verifyResolveConflictOutcome();
    if (!outcome.ok) return outcome;
    await git.push();
    return { ok: true };
  }

  // The batch loop's per-idea readiness recheck (IDEA-321) needs the same staleness
  // check run-all's launch route already runs before admitting a task.
  function checkStaleBase(planId: string): Promise<string | null> {
    return checkStaleBaseForRunAll(git, planId);
  }

  // Keeps the other machine's view at most one idea behind, not one batch —
  // the gap that caused the 2026-10-28 duplicate (IDEA-321).
  async function pushAfterIdea(): Promise<void> {
    if (!(await git.hasRemote())) return;
    await git.push();
  }

  // *Branch per idea* (IDEA-321): cuts `idea/IDEA-N` from freshly fetched main so a
  // PR-shipping project never commits straight to main.
  function beginIdeaBranch(plan: PlanEntry): Promise<string | undefined> {
    return git.ensureBranch(plan);
  }

  // Back to main once the idea branch is pushed, ready for the next idea's own branch.
  function endIdeaBranch(): Promise<void> {
    return git.checkoutBranch('main');
  }

  return {
    stampAuditDate,
    commitPhase,
    commitVerifyFix,
    setRunReview,
    commitCorpus,
    commitBookkeeping,
    annotateFixRun: annotatePhaseRun,
    snapshotWorkingTree,
    ensureUpToDate,
    settleResolveConflict,
    checkStaleBase,
    pushAfterIdea,
    beginIdeaBranch,
    endIdeaBranch,
  };
}
