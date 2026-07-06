import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readEntities } from '../../core/readers';
import { formatEntitiesIndex, formatEntityFile } from '../../core/serializer';
import type { BranchHygieneStatus, EntityEntry } from '../../types/index';

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

export type EntityFileInput = Parameters<typeof formatEntityFile>[0];

/**
 * Serializer input for re-writing an existing entity file: carries every field of
 * the parsed entry so a partial update can't silently drop the type, agent
 * override, or tags, with `overrides` applied on top.
 */
export function entityFileInput(
  entry: EntityEntry,
  overrides: Partial<EntityFileInput> = {},
): EntityFileInput {
  return {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    kind: entry.kind,
    status: entry.status,
    agent: entry.agent,
    created: entry.created,
    updated: entry.updated,
    audited: entry.audited,
    auditedHash: entry.auditedHash,
    tags: entry.tags,
    body: entry.body,
    phases: entry.phases,
    log: entry.log,
    clarifications: entry.clarifications,
    ...overrides,
  };
}

export async function writeEntityFile(path: string, input: EntityFileInput): Promise<void> {
  await writeFile(path, `${formatEntityFile(input)}\n`, 'utf-8');
}

/** Rewrites the one unified index (papercamp/ideas/index.md) from the entity corpus. */
export async function regenerateIndexes(root: string): Promise<void> {
  const ideasDir = campFile(root, 'ideas');
  const { entries } = await readEntities(ideasDir);
  await mkdir(ideasDir, { recursive: true });
  await writeFile(join(ideasDir, 'index.md'), formatEntitiesIndex(entries));
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

  // Note: branches created before the entity migration carry legacy <KIND>-<N>
  // ids that no longer match any entity, so this lookup misses and the guard
  // stays silent for them — new branches key off the entity's IDEA-N id.
  const { entries } = await readEntities(campFile(root, 'ideas'));
  const activePlan = entries.find((e) => e.id === activePlanId && e.kind !== 'note');
  if (!activePlan || activePlan.status === 'done' || activePlan.status === 'dropped') return null;
  return `Finish \`${activePlanId}\` — ${activePlan.title} — before starting another plan`;
}
