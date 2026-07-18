import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readEntitiesWithDerivedStatus } from '@/core/readers';
import { formatEntitiesIndex, formatEntityFile } from '@/core/serialize';
import type { BranchHygieneStatus, EntityEntry } from '@/types/index';

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

// Dotfile dir for machine-generated task output, distinct from the human/agent-authored corpus.
export const taskLogFile = (root: string, taskId: string) =>
  join(root, 'papercamp', '.task-logs', `${taskId}.log`);

export type EntityFileInput = Parameters<typeof formatEntityFile>[0];

// Carries every field of the parsed entry so a partial update can't silently
// drop the type, agent override, or tags; `overrides` applies on top.
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
    subject: entry.subject,
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

export async function regenerateIndexes(root: string): Promise<void> {
  const ideasDir = campFile(root, 'ideas');
  const { entries } = await readEntitiesWithDerivedStatus(ideasDir);
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
  // Must come before the hygiene check so you're never blocked from advancing your own plan.
  if (targetPlanId && activePlanId === targetPlanId) return null;
  if (!activePlanId) return null;

  const hygiene = await git.getBranchHygieneStatus();
  if (hygiene === 'stale-merged') {
    return "You're on a merged branch — switch to main before starting another plan";
  }

  // Pre-migration branches carry legacy <KIND>-<N> ids that match no entity,
  // so the lookup misses and the guard stays silent for them.
  const { entries } = await readEntitiesWithDerivedStatus(campFile(root, 'ideas'));
  const activePlan = entries.find((e) => e.id === activePlanId && e.kind !== 'note');
  if (!activePlan || activePlan.status === 'done' || activePlan.status === 'dropped') return null;
  return `Finish \`${activePlanId}\` — ${activePlan.title} — before starting another plan`;
}
