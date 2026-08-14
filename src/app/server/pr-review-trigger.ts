import { buildPrReviewPrompt } from '@/app/features/plans/prompts';
import { fetchCiReleaseState } from '@/core/ci';
import { branchName, fetchPrDiff } from '@/core/git-pr';
import type { CiReleaseState, PlanEntry, PrInfo } from '@/types/index';
import type { AgentManager } from './agent';
import type { GitManager } from './git';
import { readReviewedShas } from './pr-review-state';
import { loadManifestCi } from './routes/ci';

function isCiGreen(state: CiReleaseState): boolean {
  return (
    state.available && state.runs.length > 0 && state.runs.every((r) => r.status === 'success')
  );
}

// Fires once per PR head SHA, gated on: ready for review (open, not draft), CI
// green on that branch, unreviewed at this SHA, and root actually checked out
// on it — a stale checkout would feed the reviewer another entity's files
// (single-worktree app, so `watched` entries can lag behind the active branch).
export async function triggerPrReviews(
  root: string,
  git: Pick<GitManager, 'getCurrentBranch'>,
  agent: Pick<AgentManager, 'startPrReview'>,
  watched: PlanEntry[],
  fresh: Map<string, PrInfo>,
): Promise<void> {
  const ci = loadManifestCi(root);
  if (!ci) return;

  const reviewed = await readReviewedShas(root);
  const currentBranch = git.getCurrentBranch();

  for (const plan of watched) {
    const id = plan.id;
    if (!id) continue;
    const pr = fresh.get(id);
    if (!pr || pr.state !== 'open' || !pr.headSha) continue;
    if (reviewed[id] === pr.headSha) continue;

    const branch = pr.headBranch ?? branchName(id, plan.kind, plan.title);
    if (!branch || branch !== currentBranch) continue;

    const ciState = await fetchCiReleaseState({ ...ci, branch });
    if (!isCiGreen(ciState)) continue;

    const diff = await fetchPrDiff(root, String(pr.number));
    if (!diff) continue;

    const prompt = buildPrReviewPrompt(plan, diff);
    agent.startPrReview(plan, prompt, pr.headSha);
  }
}
