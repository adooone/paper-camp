const ORDERED_STATUSES = new Set<string>(['planned', 'in-progress', 'review']);

/** Classification input — status must be the DERIVED status (what the UI shows),
 *  not the stored frontmatter override, or merged-PR `done` entries get ordered. */
export interface RunOrderEntry {
  id: string;
  status?: string;
  order?: number;
  created: string;
}

export function isRunOrdered(entry: Pick<RunOrderEntry, 'status'>): boolean {
  return ORDERED_STATUSES.has(entry.status ?? '');
}

export interface RunOrderChange {
  id: string;
  order: number | undefined;
}

/**
 * Enforces the run-order invariant: every planned/in-progress/review entry
 * carries a contiguous 1..N order, everything else carries none. `moved`
 * places that entry at the requested slot (clamped) before renumbering.
 */
export function normalizeRunOrder(
  entries: RunOrderEntry[],
  moved?: { id: string; order: number },
): RunOrderChange[] {
  const sorted = entries.filter(isRunOrdered).sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.created.localeCompare(b.created);
  });

  if (moved) {
    const index = sorted.findIndex((e) => e.id === moved.id);
    if (index !== -1) {
      const [entry] = sorted.splice(index, 1);
      const slot = Math.min(Math.max(Math.round(moved.order), 1), sorted.length + 1);
      sorted.splice(slot - 1, 0, entry);
    }
  }

  const changes: RunOrderChange[] = [];
  sorted.forEach((entry, i) => {
    if (entry.order !== i + 1) changes.push({ id: entry.id, order: i + 1 });
  });
  for (const entry of entries) {
    if (!isRunOrdered(entry) && entry.order !== undefined) {
      changes.push({ id: entry.id, order: undefined });
    }
  }
  return changes;
}
