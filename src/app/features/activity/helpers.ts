import type { ScopeRow } from '@/app/features/scope';
import type { LogSort } from '@/core/run-filters';
import { isClosedEntity } from '@/core/status';
import type { EntityStatus, Issue, LogRow } from '@/types/index';

const pad = (n: number) => String(n).padStart(2, '0');

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return isSameDay(d, new Date()) ? time : `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${time}`;
};

export const summaryLine = (lines: string[]): string | undefined => {
  const trimmed = lines.map((line) => line.trim()).filter(Boolean);
  return trimmed.at(-1);
};

export const formatCost = (usd: number): string => {
  if (usd === 0) return '$0';
  return usd < 0.01 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`;
};

export const markReadIdFor = (row: LogRow): string | undefined => {
  if (!row.unread) return undefined;
  if (row.source.kind === 'task') return row.source.entry.id;
  if (row.source.kind === 'reply') return row.source.notification.id;
  return undefined;
};

export interface ScopedActivityEntry {
  row: LogRow;
  project?: ScopeRow;
}

const isRunningEntry = (scoped: ScopedActivityEntry): boolean => scoped.row.outcome === 'running';

const byNewestEntry = (a: ScopedActivityEntry, b: ScopedActivityEntry) =>
  b.row.timestamp.localeCompare(a.row.timestamp);

/** Merges the current project's rows with every other scope project's by time
 * (IDEA-291) — running tasks across all of them stay pinned above the rest. A
 * non-time sort has no cross-project ordering to honor, so projects keep
 * their own already-sorted order, current project first. */
export function mergeScopedActivityEntries(
  own: LogRow[],
  foreign: { project: ScopeRow; rows: LogRow[] }[],
  sort: LogSort,
  ownProject: ScopeRow | undefined,
): ScopedActivityEntry[] {
  const ownScoped = own.map((row) => ({ row, project: ownProject }));
  const foreignScoped = foreign.flatMap(({ project, rows }) =>
    rows.map((row) => ({ row, project })),
  );
  const all = [...ownScoped, ...foreignScoped];
  if (sort !== 'time') return all;

  const running = all.filter(isRunningEntry).sort(byNewestEntry);
  const rest = all.filter((scoped) => !isRunningEntry(scoped)).sort(byNewestEntry);
  return [...running, ...rest];
}

export const promoteLabel = (
  issue: Issue,
  entities: { id: string; status?: EntityStatus; archived?: boolean }[],
): string => {
  const parent = issue.entityId ? entities.find((p) => p.id === issue.entityId) : undefined;
  if (!parent) return 'Promote to idea';
  return isClosedEntity(parent) ? 'Promote to fix' : `Add to ${parent.id}'s fixes`;
};
