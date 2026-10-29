import { findFocusPlan } from '../app/features/plans/helpers';
import { createGitManager } from '../app/server/git';
import { fileExists, planFile } from '../app/server/helpers';
import { readCorpus } from '../core/corpus';
import type { PlanEntry } from '../types/index';

function renderPlanLine(plan: PlanEntry): string {
  const done = plan.phases.filter((p) => p.done).length;
  const total = plan.phases.length;
  const progress = total > 0 ? `, ${done}/${total} phases` : '';
  const next = plan.phases.find((p) => !p.done);
  const lines = [
    `**Active plan:** ${plan.id ?? '(no id)'} — ${plan.title} (${plan.status}${progress})`,
  ];
  if (next) lines.push(`**Next phase:** ${next.text}`);
  return lines.join('\n');
}

// No stored `now.md`: recomputed every session so it can't drift from the
// plans/log it's summarizing.
export async function buildSessionFocus(root: string): Promise<string | null> {
  if (!(await fileExists(planFile(root, 'ideas')))) return null;

  const { work } = await readCorpus(root, { live: true });
  const git = createGitManager(root);
  const branchPlanId = git.getFeatureBranchPlanId();
  const plan =
    (branchPlanId ? work.find((p) => p.id === branchPlanId) : undefined) ?? findFocusPlan(work);

  const sections: string[] = ['## Paper Camp focus'];
  sections.push(plan ? renderPlanLine(plan) : '**Active plan:** none in progress');
  return sections.join('\n\n');
}
