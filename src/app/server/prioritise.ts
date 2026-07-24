import { join } from 'node:path';
import { buildPrioritisePrompt } from '@/app/features/plans/prompts';
import { readEntities, readWorkEntries } from '@/core/readers';
import { type RunOrderEntry, normalizeRunOrder } from '@/core/run-order';
import { todayDateString } from '@/core/serialize';
import type { PlanEntry, PrioritiseVerdict } from '@/types/index';
import {
  campFile,
  entityFileInput,
  fileExists,
  regenerateIndexes,
  writeEntityFile,
} from './helpers';

function validatePrioritiseVerdict(
  candidate: string,
  activeIds: string[],
): PrioritiseVerdict | undefined {
  try {
    const parsed = JSON.parse(candidate) as { order?: string[]; why?: string };
    if (!Array.isArray(parsed.order) || typeof parsed.why !== 'string') return undefined;
    // Every active id exactly once: no gaps, dupes, or ids outside the active set.
    if (parsed.order.length !== activeIds.length) return undefined;
    const seen = new Set(parsed.order);
    if (seen.size !== activeIds.length) return undefined;
    if (!activeIds.every((id) => seen.has(id))) return undefined;
    // One non-empty reason per ordered id, same index, per the prompt's contract.
    const whyLines = parsed.why.split('\n').filter((line) => line.trim().length > 0);
    if (whyLines.length !== parsed.order.length) return undefined;
    return { order: parsed.order, why: parsed.why };
  } catch {
    return undefined;
  }
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

  const verdict = validatePrioritiseVerdict(match[0], activeIds);
  if (!verdict) {
    throw new Error('Agent verdict did not include every active id exactly once');
  }
  return verdict;
}

// Applies the verdict's target order one id at a time via normalizeRunOrder's
// existing single-slot `moved` primitive — the same mechanism the plans PATCH
// route uses for one drag, run N times to reach an arbitrary full permutation.
function resolveFullOrder(entries: RunOrderEntry[], targetOrder: string[]): RunOrderEntry[] {
  let current = entries;
  for (const [i, id] of targetOrder.entries()) {
    const changes = normalizeRunOrder(current, { id, order: i + 1 });
    if (changes.length === 0) continue;
    const changed = new Map(changes.map((c) => [c.id, c.order]));
    current = current.map((e) => (changed.has(e.id) ? { ...e, order: changed.get(e.id) } : e));
  }
  return current;
}

/** Applies a prioritise verdict: reorders the active queue and appends the
 *  matching `why` line as a log comment to each idea whose order actually moved. */
export async function applyPrioritiseVerdict(
  root: string,
  verdict: PrioritiseVerdict,
): Promise<string[]> {
  const ideasDir = campFile(root, 'ideas');
  const { entries } = await readEntities(ideasDir);
  const { entries: work } = await readWorkEntries(ideasDir);
  const derived = new Map(work.map((w) => [w.id, w.status as string | undefined]));

  const classified: RunOrderEntry[] = entries
    .filter((e) => e.kind !== 'note')
    .map((e) => ({
      id: e.id,
      order: e.order,
      created: e.created,
      status: derived.get(e.id) ?? e.status,
    }));

  const resolved = resolveFullOrder(classified, verdict.order);
  const originalOrder = new Map(classified.map((e) => [e.id, e.order]));
  const whyLines = verdict.why.split('\n').filter((line) => line.trim().length > 0);
  const reasonFor = (id: string) => {
    const index = verdict.order.indexOf(id);
    return whyLines[index]?.trim() || 'Reprioritised by the shuffle agent.';
  };

  const moved = resolved.filter((e) => e.order !== originalOrder.get(e.id));
  if (moved.length === 0) return [];

  const applied: string[] = [];
  for (const change of moved) {
    const primaryFile = join(ideasDir, `${change.id}.md`);
    const file = (await fileExists(primaryFile))
      ? primaryFile
      : join(ideasDir, 'archive', `${change.id}.md`);
    if (!(await fileExists(file))) continue;
    const entry = entries.find((e) => e.id === change.id);
    if (!entry) continue;
    // Only entries the agent actually ranked get a log line — normalizeRunOrder's
    // own clearing of stale order on now-inactive entries also lands in `moved`.
    const isAgentRanked = verdict.order.includes(change.id);
    try {
      await writeEntityFile(
        file,
        entityFileInput(entry, {
          order: change.order,
          log: isAgentRanked
            ? [...(entry.log ?? []), { date: todayDateString(), text: reasonFor(change.id) }]
            : entry.log,
        }),
      );
      applied.push(change.id);
    } catch (err) {
      await regenerateIndexes(root);
      throw new Error(
        `Prioritise partially applied (${applied.length}/${moved.length} ideas updated) before failing on ${change.id}: ${(err as Error).message}`,
      );
    }
  }

  await regenerateIndexes(root);
  return applied;
}
