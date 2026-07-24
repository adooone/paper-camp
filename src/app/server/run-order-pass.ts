import { join } from 'node:path';
import { readEntities, readWorkEntries } from '@/core/readers';
import { normalizeRunOrder } from '@/core/run-order';
import {
  campFile,
  entityFileInput,
  fileExists,
  regenerateIndexes,
  writeEntityFile,
} from './helpers';

/**
 * Reflows the run-order invariant across every write path (routes, agents, hand
 * edits, git pulls) rather than just the plans PATCH route. Writes only the
 * entries whose order actually changes, so a pass triggered by its own writes
 * finds the invariant already holding and no-ops.
 */
export async function runRunOrderPass(root: string): Promise<string[]> {
  const ideasDir = campFile(root, 'ideas');
  const { entries } = await readEntities(ideasDir);
  const { entries: work } = await readWorkEntries(ideasDir);
  const derived = new Map(work.map((w) => [w.id, w.status as string | undefined]));

  const classified = entries
    .filter((e) => e.kind !== 'note')
    .map((e) => ({
      id: e.id,
      order: e.order,
      created: e.created,
      status: derived.get(e.id) ?? e.status,
    }));

  const changes = normalizeRunOrder(classified);
  if (changes.length === 0) return [];

  for (const change of changes) {
    const primaryFile = join(ideasDir, `${change.id}.md`);
    const file = (await fileExists(primaryFile))
      ? primaryFile
      : join(ideasDir, 'archive', `${change.id}.md`);
    if (!(await fileExists(file))) continue;
    const entry = entries.find((e) => e.id === change.id);
    if (!entry) continue;
    await writeEntityFile(file, entityFileInput({ ...entry, order: change.order }));
  }

  await regenerateIndexes(root);
  return changes.map((c) => c.id);
}
