import type { RunOrderFileEntry } from './run-order-file';

const ORDERED_STATUSES = new Set<string>(['planned', 'in-progress', 'review']);

/** Classification input — status must be the DERIVED status (what the UI shows),
 *  not the stored frontmatter override, or merged-PR `done` entries get ordered. */
export interface RunOrderEntry {
  id: string;
  title: string;
  status?: string;
  order?: number;
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

export interface RunOrderChange {
  id: string;
  order: number | undefined;
}

/**
 * Bridges normalizeRunOrder into today's frontmatter-order world: until write paths
 * read/write papercamp/run-order.md directly (IDEA-98 phase 4), the "list" is derived
 * from each entry's current `order` field, reconciled, and diffed back to per-entry
 * frontmatter changes.
 */
export function reconcileFrontmatterOrder(
  entries: RunOrderEntry[],
  moved?: { id: string; order: number },
): RunOrderChange[] {
  const list: RunOrderFileEntry[] = entries
    .filter(isRunOrdered)
    .sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.created.localeCompare(b.created);
    })
    .map((e) => ({ id: e.id, title: e.title }));

  const reconciled = normalizeRunOrder(list, entries, moved);

  const changes: RunOrderChange[] = [];
  reconciled.forEach((item, i) => {
    const entry = byId(entries, item.id);
    if (entry && entry.order !== i + 1) changes.push({ id: item.id, order: i + 1 });
  });
  for (const entry of entries) {
    if (!isRunOrdered(entry) && entry.order !== undefined) {
      changes.push({ id: entry.id, order: undefined });
    }
  }
  return changes;
}

function byId(entries: RunOrderEntry[], id: string): RunOrderEntry | undefined {
  return entries.find((e) => e.id === id);
}
