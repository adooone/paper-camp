import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertCorpusWritable } from '@/core/corpus-format';
import { readEntitiesWithDerivedStatus } from '@/core/readers';
import {
  type RunOrderFileEntry,
  formatRunOrderFile,
  parseRunOrderFile,
} from '@/core/run-order-file';
import { formatEntityFile } from '@/core/serialize';
import type { BranchHygieneStatus, EntityEntry, StaleBaseRef } from '@/types/index';

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
    idea: entry.idea,
    agent: entry.agent,
    created: entry.created,
    updated: entry.updated,
    audited: entry.audited,
    auditedHash: entry.auditedHash,
    released: entry.released,
    tags: entry.tags,
    subject: entry.subject,
    order: entry.order,
    issueSource: entry.issueSource,
    body: entry.body,
    phases: entry.phases,
    fixes: entry.fixes,
    thread: entry.thread,
    unknownFrontmatter: entry.unknownFrontmatter,
    ...overrides,
  };
}

export async function writeEntityFile(
  root: string,
  path: string,
  input: EntityFileInput,
): Promise<void> {
  await assertCorpusWritable(campFile(root, 'config.json'));
  await writeFile(path, `${formatEntityFile(input)}\n`, 'utf-8');
}

export const runOrderFilePath = (root: string) => campFile(root, 'run-order.md');

export async function readRunOrderFile(root: string): Promise<RunOrderFileEntry[]> {
  return parseRunOrderFile(await readMaybe(runOrderFilePath(root)));
}

export async function writeRunOrderFile(root: string, list: RunOrderFileEntry[]): Promise<void> {
  await writeFile(runOrderFilePath(root), formatRunOrderFile(list), 'utf-8');
}

// Every read-normalize-write of run-order.md (plans PATCH, the activity-triggered
// pass, applyPrioritiseVerdict) must run as one critical section, or an interleaved
// pass can normalize against a stale read and clobber a concurrent write.
let runOrderLock: Promise<unknown> = Promise.resolve();

export function withRunOrderLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = runOrderLock.then(fn, fn);
  runOrderLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
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

// See IDEA-171: a branch forked before another ref finished this plan's phases would
// otherwise redo that work invisibly. Refuse rather than warn — the failure is silent
// and expensive to clean up by hand.
export async function checkStaleBaseForRunAll(
  git: { findStaleBaseRef: (id: string) => Promise<StaleBaseRef | null> },
  planId: string,
): Promise<string | null> {
  const stale = await git.findStaleBaseRef(planId);
  if (!stale) return null;
  return `${planId} already has ${stale.done}/${stale.total} phases complete on ${stale.ref}. This branch is forked from before that work — rebase or switch branches.`;
}
