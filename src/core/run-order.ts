import type { RunOrderFileEntry } from './run-order-file';

const ORDERED_STATUSES = new Set<string>(['planned', 'in-progress', 'review']);

/** Classification input — status must be the DERIVED status (what the UI shows),
 *  not the stored frontmatter override, or merged-PR `done` entries get ordered. */
export interface RunOrderEntry {
  id: string;
  title: string;
  status?: string;
  created: string;
}

export function isRunOrdered(entry: Pick<RunOrderEntry, 'status'>): boolean {
  return ORDERED_STATUSES.has(entry.status ?? '');
}

/**
 * Reconciles a persisted run-order list against the live corpus: drops ids the list
 * carries that are gone from the corpus or no longer in an ordered status, appends
 * ordered entities missing from the list (entities added out of band, oldest first),
 * refreshes titles from the corpus, and applies an optional single-slot move. Returns
 * the full list, ready to write in one shot instead of N frontmatter changes.
 */
export function normalizeRunOrder(
  list: RunOrderFileEntry[],
  entries: RunOrderEntry[],
  moved?: { id: string; order: number },
): RunOrderFileEntry[] {
  const byId = new Map(entries.map((e) => [e.id, e]));

  const kept = list
    .map((item) => byId.get(item.id))
    .filter((e): e is RunOrderEntry => e !== undefined && isRunOrdered(e));
  const keptIds = new Set(kept.map((e) => e.id));

  const appended = entries
    .filter((e) => isRunOrdered(e) && !keptIds.has(e.id))
    .sort((a, b) => a.created.localeCompare(b.created));

  const sequence = [...kept, ...appended];

  if (moved) {
    const index = sequence.findIndex((e) => e.id === moved.id);
    if (index !== -1) {
      const [entry] = sequence.splice(index, 1);
      const slot = Math.min(Math.max(Math.round(moved.order), 1), sequence.length + 1);
      sequence.splice(slot - 1, 0, entry);
    }
  }

  return sequence.map((e) => ({ id: e.id, title: e.title }));
}

/** Two reconciled lists are equal when they carry the same ids in the same order. */
export function sameRunOrder(a: RunOrderFileEntry[], b: RunOrderFileEntry[]): boolean {
  return a.length === b.length && a.every((e, i) => e.id === b[i].id);
}
