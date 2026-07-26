import { readEntities, readWorkEntries } from '@/core/readers';
import { type RunOrderEntry, normalizeRunOrder } from '@/core/run-order';
import type { RunOrderFileEntry } from '@/core/run-order-file';
import { campFile, readRunOrderFile, writeRunOrderFile } from './helpers';

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

/**
 * Reflows the run-order invariant across every write path (routes, agents, hand
 * edits, git pulls) rather than just the plans PATCH route. Writes the list only
 * when it actually changes, so a pass triggered by its own write finds the
 * invariant already holding and no-ops.
 */
export async function runRunOrderPass(root: string): Promise<string[]> {
  const ideasDir = campFile(root, 'ideas');
  const { entries } = await readEntities(ideasDir);
  const { entries: work } = await readWorkEntries(ideasDir);
  const derived = new Map(work.map((w) => [w.id, w.status as string | undefined]));

  const classified: RunOrderEntry[] = entries
    .filter((e) => e.kind !== 'note')
    .map((e) => ({
      id: e.id,
      title: e.title,
      created: e.created,
      status: derived.get(e.id) ?? e.status,
    }));

  const list = await readRunOrderFile(root);
  const reconciled = normalizeRunOrder(list, classified);
  const changed = changedIds(list, reconciled);
  if (changed.length === 0) return [];

  await writeRunOrderFile(root, reconciled);
  return changed;
}
