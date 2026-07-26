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
 * Builds the classified `RunOrderEntry[]` input to `normalizeRunOrder` from the raw
 * corpus (`entries`) and its derived-status counterpart (`work`), applying an optional
 * per-id status override on top (e.g. an in-flight PATCH not yet persisted to disk).
 * Shared by every write path so classification only lives in one place.
 */
export function classifyRunOrderEntries(
  entries: { id: string; title: string; created: string; status?: string; kind?: 'note' }[],
  work: { id?: string; status?: string }[],
  statusOverride?: (id: string) => { value: string | undefined } | undefined,
): RunOrderEntry[] {
  const derived = new Map(
    work.filter((w) => w.id !== undefined).map((w) => [w.id as string, w.status]),
  );
  return entries
    .filter((e) => e.kind !== 'note')
    .map((e) => {
      const override = statusOverride?.(e.id);
      return {
        id: e.id,
        title: e.title,
        created: e.created,
        status: override ? override.value : (derived.get(e.id) ?? e.status),
      };
    });
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

  const keptIds = new Set<string>();
  const kept: RunOrderEntry[] = [];
  for (const item of list) {
    if (keptIds.has(item.id)) continue;
    const e = byId.get(item.id);
    if (e === undefined || !isRunOrdered(e)) continue;
    keptIds.add(e.id);
    kept.push(e);
  }

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
