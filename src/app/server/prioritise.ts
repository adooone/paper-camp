import { join } from 'node:path';
import { buildPrioritisePrompt } from '@/app/features/plans/prompts';
import { readEntities, readWorkEntries } from '@/core/readers';
import { classifyRunOrderEntries, normalizeRunOrder } from '@/core/run-order';
import type { RunOrderFileEntry } from '@/core/run-order-file';
import { agentThreadMessage } from '@/core/serialize';
import type { PlanEntry, PrioritiseVerdict } from '@/types/index';
import {
  campFile,
  entityFileInput,
  fileExists,
  readRunOrderFile,
  withRunOrderLock,
  writeEntityFile,
  writeRunOrderFile,
} from './helpers';

function validatePrioritiseVerdict(candidate: string, activeIds: string[]): PrioritiseVerdict {
  let parsed: { order?: string[]; why?: string };
  try {
    parsed = JSON.parse(candidate) as { order?: string[]; why?: string };
  } catch {
    throw new Error('Agent verdict was not valid JSON');
  }
  if (!Array.isArray(parsed.order) || typeof parsed.why !== 'string') {
    throw new Error('Agent verdict was missing an `order` array or a `why` string');
  }
  if (parsed.order.length !== activeIds.length) {
    throw new Error(
      `Agent verdict ordered ${parsed.order.length} ideas but ${activeIds.length} are active`,
    );
  }
  const orderSeen = new Set<string>();
  for (const id of parsed.order) {
    if (orderSeen.has(id)) throw new Error(`Agent verdict listed id "${id}" more than once`);
    orderSeen.add(id);
  }
  const activeSet = new Set(activeIds);
  const unknown = parsed.order.find((id) => !activeSet.has(id));
  if (unknown) {
    throw new Error(`Agent verdict included id "${unknown}", which is not in the active set`);
  }
  const missing = activeIds.find((id) => !orderSeen.has(id));
  if (missing) {
    throw new Error(`Agent verdict is missing active id "${missing}"`);
  }
  return { order: parsed.order, why: parsed.why };
}

// One-shot, read-only agent call, not the long-running phase/task system in
// agent.ts: runs independently of the task registry, so it's never blocked by
// (and never blocks) a running phase/reconcile/etc.
export async function getPrioritiseVerdict(
  worklist: PlanEntry[],
  roadmapText: string,
  runPrompt: (prompt: string) => Promise<string>,
): Promise<PrioritiseVerdict> {
  const activeIds = worklist
    .filter((p) => p.status === 'planned' || p.status === 'in-progress' || p.status === 'review')
    .map((p) => p.id)
    .filter((id): id is string => Boolean(id));

  if (activeIds.length === 0) {
    throw new Error('No planned/in-progress/review ideas to prioritise');
  }

  const prompt = buildPrioritisePrompt(worklist, roadmapText);
  const output = await runPrompt(prompt);

  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {}

  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent did not return a parseable prioritise verdict');

  return validatePrioritiseVerdict(match[0], activeIds);
}

function changedIds(before: RunOrderFileEntry[], after: RunOrderFileEntry[]): string[] {
  const changed = new Set<string>();
  const len = Math.max(before.length, after.length);
  for (let i = 0; i < len; i++) {
    if (before[i]?.id !== after[i]?.id) {
      if (before[i]) changed.add(before[i].id);
      if (after[i]) changed.add(after[i].id);
    }
  }
  return [...changed];
}

export interface ApplyPrioritiseResult {
  /** Ids whose position changed and were written to run-order.md. */
  moved: string[];
  /** Subset of `moved` that also got the `why` thread message appended. */
  annotated: string[];
  /** Set when annotation stopped early because a write failed. */
  annotationError?: string;
}

/** Applies a prioritise verdict: reorders papercamp/run-order.md to the agent's
 *  target sequence and appends the matching `why` line as a log comment to each
 *  ranked idea whose position actually moved.
 *
 *  The reorder and the annotations are two separate writes — if an annotation
 *  fails partway through, the reorder that already happened is not rolled
 *  back or hidden: `moved` always reflects the ids actually reordered on
 *  disk, and `annotated` reports how many of them got their `why` line. */
export async function applyPrioritiseVerdict(
  root: string,
  verdict: PrioritiseVerdict,
): Promise<ApplyPrioritiseResult> {
  const ideasDir = campFile(root, 'ideas');
  const { entries } = await readEntities(ideasDir);
  const { entries: work } = await readWorkEntries(ideasDir);
  const classified = classifyRunOrderEntries(entries, work);
  const byId = new Map(classified.map((e) => [e.id, e]));

  const proposed: RunOrderFileEntry[] = verdict.order.map((id) => ({
    id,
    title: byId.get(id)?.title ?? '',
  }));

  const moved = await withRunOrderLock(async () => {
    const list = await readRunOrderFile(root);
    const reconciled = normalizeRunOrder(proposed, classified);
    const moved = changedIds(list, reconciled).filter((id) => verdict.order.includes(id));
    if (moved.length > 0) await writeRunOrderFile(root, reconciled);
    return moved;
  });
  if (moved.length === 0) return { moved: [], annotated: [] };

  const whyLines = verdict.why.split('\n').filter((line) => line.trim().length > 0);
  const reasonFor = (id: string) => {
    const index = verdict.order.indexOf(id);
    return whyLines[index]?.trim() || 'Reprioritised by the shuffle agent.';
  };

  const annotated: string[] = [];
  let annotationError: string | undefined;
  for (const id of moved) {
    const primaryFile = join(ideasDir, `${id}.md`);
    const file = (await fileExists(primaryFile))
      ? primaryFile
      : join(ideasDir, 'archive', `${id}.md`);
    if (!(await fileExists(file))) continue;
    const entry = entries.find((e) => e.id === id);
    if (!entry) continue;
    try {
      await writeEntityFile(
        root,
        file,
        entityFileInput(entry, {
          thread: [...(entry.thread ?? []), agentThreadMessage(reasonFor(id))],
        }),
      );
      annotated.push(id);
    } catch (err) {
      annotationError = `Failed to annotate ${id}: ${(err as Error).message}`;
      break;
    }
  }

  return { moved, annotated, ...(annotationError ? { annotationError } : {}) };
}
