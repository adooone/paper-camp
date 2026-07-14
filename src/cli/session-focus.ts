import { findFocusPlan } from '../app/features/plans/helpers';
import { createGitManager } from '../app/server/git';
import { campFile, fileExists, readMaybe } from '../app/server/helpers';
import { parseProgress } from '../core/parse';
import { readWorkEntries } from '../core/readers';
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

/**
 * Derives a focus block from live papercamp/ state — the in-progress plan (preferring
 * the one tied to the current feature branch), plus the last 3 progress.md bullets.
 * No stored `now.md`: this is recomputed every session so it can't drift from the
 * plans/log it's summarizing.
 */
export async function buildSessionFocus(root: string): Promise<string | null> {
  if (!(await fileExists(campFile(root, 'ideas')))) return null;

  const { entries } = await readWorkEntries(campFile(root, 'ideas'));
  const git = createGitManager(root, { watch: false });
  const branchPlanId = git.getFeatureBranchPlanId();
  const plan =
    (branchPlanId ? entries.find((p) => p.id === branchPlanId) : undefined) ??
    findFocusPlan(entries);

  const progressRaw = await readMaybe(campFile(root, 'progress.md'));
  const recentItems = parseProgress(progressRaw)
    .flatMap((entry) => entry.items.map((item) => `${entry.date}: ${item}`))
    .slice(0, 3);

  const sections: string[] = ['## Paper Camp focus'];
  sections.push(plan ? renderPlanLine(plan) : '**Active plan:** none in progress');
  if (recentItems.length > 0) {
    sections.push(['**Recent progress:**', ...recentItems.map((item) => `- ${item}`)].join('\n'));
  }
  return sections.join('\n\n');
}
