import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deriveIdeaStatuses } from '../../core/idea-status';
import { readIdeasMerged, readPlansMerged } from '../../core/readers';
import { formatIdeasIndex, formatPlanFile, formatPlansIndex } from '../../core/serializer';
import type { BranchHygieneStatus, PlanEntry } from '../../types/index';

export async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export const campFile = (root: string, name: string) => join(root, 'papercamp', name);

export type PlanFileInput = Parameters<typeof formatPlanFile>[0];

/**
 * Serializer input for re-writing an existing plan file: carries every field of the
 * parsed entry so a partial update can't silently drop idea backlinks, agent
 * overrides, or tags, with `overrides` applied on top.
 */
export function planFileInput(
  entry: PlanEntry,
  overrides: Partial<PlanFileInput> = {},
): PlanFileInput {
  return {
    id: entry.id ?? '',
    title: entry.title,
    kind: entry.kind ?? 'feat',
    status: entry.status,
    idea: entry.idea,
    agent: entry.agent,
    created: entry.created,
    updated: entry.updated,
    audited: entry.audited,
    tags: entry.tags,
    body: entry.body,
    phases: entry.phases,
    log: entry.log,
    clarifications: entry.clarifications,
    ...overrides,
  };
}

export async function writePlanFile(path: string, input: PlanFileInput): Promise<void> {
  await writeFile(path, `${formatPlanFile(input)}\n`, 'utf-8');
}

export async function regenerateIndexes(root: string): Promise<void> {
  const plansDir = campFile(root, 'plans');
  const ideasDir = campFile(root, 'ideas');

  const [plansResult, ideasResult] = await Promise.all([
    readPlansMerged(plansDir, campFile(root, 'plans.md')),
    readIdeasMerged(ideasDir, campFile(root, 'ideas.md')),
  ]);

  const ideasWithStatus = deriveIdeaStatuses(ideasResult.entries, plansResult.entries);

  await mkdir(plansDir, { recursive: true });
  await mkdir(ideasDir, { recursive: true });

  await Promise.all([
    writeFile(join(plansDir, 'index.md'), formatPlansIndex(plansResult.entries)),
    writeFile(join(ideasDir, 'index.md'), formatIdeasIndex(ideasWithStatus)),
  ]);
}

export async function checkBranchConflictForPlan(
  root: string,
  git: {
    getFeatureBranchPlanId: () => string | null;
    getBranchHygieneStatus: () => Promise<BranchHygieneStatus>;
  },
  targetPlanId?: string,
): Promise<string | null> {
  const activePlanId = git.getFeatureBranchPlanId();
  // Working on the current branch's own plan (e.g. running its phases) is always
  // allowed — this must come before any hygiene/other check so you can never be
  // blocked from advancing the plan you're already on.
  if (targetPlanId && activePlanId === targetPlanId) return null;
  // Not on a feature branch (on main, etc.) — nothing to finish first.
  if (!activePlanId) return null;

  // Only relevant when starting a *different* plan than the one this branch is for.
  const hygiene = await git.getBranchHygieneStatus();
  if (hygiene === 'stale-merged') {
    return "You're on a merged branch — switch to main before starting another plan";
  }

  const plansDir = campFile(root, 'plans');
  const { entries } = await readPlansMerged(plansDir, campFile(root, 'plans.md'));
  const activePlan = entries.find((p) => p.id === activePlanId);
  if (!activePlan || activePlan.status === 'done' || activePlan.status === 'dropped') return null;
  return `Finish \`${activePlanId}\` — ${activePlan.title} — before starting another plan`;
}
