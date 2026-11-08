import type { ScopeRow } from '@/app/features/scope';
import { type IdeaStatus, PLAN_STATUSES, type PlanStatus, type WorklistEntry } from '@/types/index';
import { DEFAULT_GROUP_MODE, type GroupMode } from './group-mode';

export type PlanSortKey = 'status' | 'updated' | 'title' | 'id' | 'progress' | 'order';
export type SortDirection = 'asc' | 'desc';

export interface PlanListFilters {
  statuses: PlanStatus[];
  tags: string[];
  search: string;
  sortKey: PlanSortKey;
  sortDirection: SortDirection;
  /** Filter chip for `kind: note` ideas — separate lifecycle from PlanStatus. */
  noteStatuses: IdeaStatus[];
  /** Set by a roadmap item's "N in queue" link; null means unfiltered. */
  subject: string | null;
  /** How the worklist is grouped; kept with the filters so it survives opening a plan. */
  group: GroupMode;
}

/** Excludes done/dropped so 40+ closed plans stay out of first paint until a chip reveals them. */
const DEFAULT_VISIBLE_STATUSES: PlanStatus[] = ['in-progress', 'review', 'planned', 'idea'];

/** Mirrors DEFAULT_VISIBLE_STATUSES: closed notes stay out of first paint too. */
const DEFAULT_VISIBLE_NOTE_STATUSES: IdeaStatus[] = ['open'];

export const DEFAULT_PLAN_LIST_FILTERS: PlanListFilters = {
  statuses: DEFAULT_VISIBLE_STATUSES,
  tags: [],
  search: '',
  sortKey: 'order',
  sortDirection: 'asc',
  noteStatuses: DEFAULT_VISIBLE_NOTE_STATUSES,
  subject: null,
  group: DEFAULT_GROUP_MODE,
};

/** The sidebar's Status section and the old toolbar chips share this order. */
export const STATUS_FILTER_ORDER: PlanStatus[] = [
  'in-progress',
  'review',
  'planned',
  'idea',
  'done',
  'dropped',
];

export const isDefaultStatusFilter = (statuses: PlanStatus[]): boolean =>
  statuses.length === DEFAULT_PLAN_LIST_FILTERS.statuses.length &&
  DEFAULT_PLAN_LIST_FILTERS.statuses.every((status) => statuses.includes(status));

const STATUS_ORDER: Record<PlanStatus, number> = {
  'in-progress': 0,
  review: 1,
  planned: 2,
  idea: 3,
  done: 4,
  dropped: 5,
};

export interface PlanListResult {
  rows: WorklistEntry[];
  statusCounts: Record<PlanStatus, number>;
  tagCounts: Record<string, number>;
}

const updatedTimestamp = (entry: WorklistEntry): number => {
  const parsed = new Date(entry.updated ?? entry.created).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const createdTimestamp = (entry: WorklistEntry): number => {
  const parsed = new Date(entry.created).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const idNumber = (entry: WorklistEntry): number => {
  const match = entry.id.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const phasePct = (entry: WorklistEntry): number | null =>
  entry.phasesTotal === 0 ? null : Math.round((entry.phasesDone / entry.phasesTotal) * 100);

const matchesSearch = (entry: WorklistEntry, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return entry.title.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle);
};

const matchesTags = (entry: WorklistEntry, tags: Set<string>): boolean => {
  if (tags.size === 0) return true;
  return entry.tags.some((tag) => tags.has(tag));
};

const matchesSubject = (subject: string | undefined, filterSubject: string | null): boolean =>
  filterSubject === null || subject === filterSubject;

const planStatus = (entry: WorklistEntry): PlanStatus => entry.status as PlanStatus;

const activeRank = (entry: WorklistEntry): number =>
  entry.status === 'in-progress' || entry.status === 'review' ? 0 : 1;

const compareEntries = (
  a: WorklistEntry,
  b: WorklistEntry,
  key: PlanSortKey,
  direction: SortDirection = 'asc',
): number => {
  const pinDiff = activeRank(a) - activeRank(b);
  if (pinDiff !== 0) return pinDiff;
  if (key === 'order') {
    if (a.order !== undefined && b.order !== undefined) {
      const dirMul = direction === 'desc' ? -1 : 1;
      return dirMul * (a.order - b.order);
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return createdTimestamp(a) - createdTimestamp(b);
  }
  const cmp = (() => {
    switch (key) {
      case 'status': {
        const byStatus = STATUS_ORDER[planStatus(a)] - STATUS_ORDER[planStatus(b)];
        if (byStatus !== 0) return byStatus;
        return updatedTimestamp(b) - updatedTimestamp(a);
      }
      case 'updated':
        return updatedTimestamp(b) - updatedTimestamp(a);
      case 'title':
        return a.title.localeCompare(b.title);
      case 'id':
        return idNumber(a) - idNumber(b);
      case 'progress':
        return (phasePct(b) ?? -1) - (phasePct(a) ?? -1);
      default:
        return 0;
    }
  })();
  return direction === 'desc' ? -cmp : cmp;
};

const countBy = <Entry, Value>(
  entries: Entry[],
  key: (entry: Entry) => Value[],
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    for (const value of key(entry)) {
      counts[String(value)] = (counts[String(value)] ?? 0) + 1;
    }
  }
  return counts;
};

export const selectPlanRows = (
  entries: WorklistEntry[],
  filters: PlanListFilters = DEFAULT_PLAN_LIST_FILTERS,
): PlanListResult => {
  const tagSet = new Set(filters.tags);
  const statusSet = new Set<string>(filters.statuses);

  const statusCounts = countBy(
    entries.filter(
      (entry) =>
        matchesTags(entry, tagSet) &&
        matchesSearch(entry, filters.search) &&
        matchesSubject(entry.subject, filters.subject),
    ),
    (entry) => [entry.status],
  ) as Record<PlanStatus, number>;
  for (const status of PLAN_STATUSES) statusCounts[status] ??= 0;

  const tagCounts = countBy(
    entries.filter(
      (entry) =>
        statusSet.has(entry.status) &&
        matchesSearch(entry, filters.search) &&
        matchesSubject(entry.subject, filters.subject),
    ),
    (entry) => entry.tags,
  );

  const rows = entries
    .filter(
      (entry) =>
        statusSet.has(entry.status) &&
        matchesTags(entry, tagSet) &&
        matchesSearch(entry, filters.search) &&
        matchesSubject(entry.subject, filters.subject),
    )
    .sort((a, b) => compareEntries(a, b, filters.sortKey, filters.sortDirection));

  return { rows, statusCounts, tagCounts };
};

const IDEA_STATUSES: IdeaStatus[] = ['open', 'done', 'dropped'];

const NOTE_STATUS_TIER: Record<IdeaStatus, PlanStatus> = {
  open: 'idea',
  done: 'done',
  dropped: 'dropped',
};

const noteStatus = (entry: WorklistEntry): IdeaStatus =>
  entry.status === 'done' || entry.status === 'dropped' ? entry.status : 'open';

export interface NoteRow {
  type: 'note';
  entry: WorklistEntry;
  project?: ScopeRow;
}

export interface PlanRow {
  type: 'plan';
  entry: WorklistEntry;
  project?: ScopeRow;
}

export interface FixRow {
  type: 'fix';
  entry: WorklistEntry;
  project?: ScopeRow;
}

export type WorklistRow = NoteRow | PlanRow | FixRow;

export interface SubjectGroup {
  subject: string | null;
  rows: WorklistRow[];
}

const rowUpdatedTimestamp = (row: WorklistRow): number => {
  const raw = row.type === 'note' ? row.entry.created : (row.entry.updated ?? row.entry.created);
  const parsed = new Date(raw ?? '').getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const groupOrderRank = (rows: WorklistRow[], direction: SortDirection): number | undefined =>
  rows.reduce<number | undefined>((best, row) => {
    const rowRank = row.entry.order;
    if (rowRank === undefined) return best;
    if (best === undefined) return rowRank;
    return direction === 'desc' ? Math.max(best, rowRank) : Math.min(best, rowRank);
  }, undefined);

const groupLatestUpdate = (rows: WorklistRow[]): number =>
  rows.reduce((latest, row) => Math.max(latest, rowUpdatedTimestamp(row)), 0);

const projectKey = (row: WorklistRow): string => row.project?.runtimeUrl ?? '';

/** Groups already-sorted worklist rows by subject, keeping each row's relative
 * order within a group; rows with no subject collect into the virtual "No subject"
 * group, last. A row whose subject is not in its own project's vocabulary demotes
 * to "No subject" without touching the idea file; a project with no vocabulary
 * entry keeps every subject. Named groups order by the leading run-order rank
 * among their rows, so a group's position matches where its top-priority row
 * would land if the rows were flattened. Groups with no ranked row come after,
 * newest-updated first. */
export const groupRowsBySubject = (
  rows: WorklistRow[],
  sortDirection: SortDirection = 'asc',
  validSubjects?: Map<string, Set<string>>,
): SubjectGroup[] => {
  const bySubject = new Map<string, WorklistRow[]>();
  const noSubject: WorklistRow[] = [];

  for (const row of rows) {
    const subject = row.entry.subject;
    const vocabulary = validSubjects?.get(projectKey(row));
    if (!subject || (vocabulary && !vocabulary.has(subject))) {
      noSubject.push(row);
      continue;
    }
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject)?.push(row);
  }

  const dirMul = sortDirection === 'desc' ? -1 : 1;
  const groups: SubjectGroup[] = [...bySubject.entries()]
    .map(([subject, groupRows]) => ({ subject, rows: groupRows }))
    .sort((a, b) => {
      const rankA = groupOrderRank(a.rows, sortDirection);
      const rankB = groupOrderRank(b.rows, sortDirection);
      if (rankA !== undefined && rankB !== undefined) return dirMul * (rankA - rankB);
      if (rankA !== undefined) return -1;
      if (rankB !== undefined) return 1;
      return groupLatestUpdate(b.rows) - groupLatestUpdate(a.rows);
    });

  if (noSubject.length > 0) groups.push({ subject: null, rows: noSubject });
  return groups;
};

export interface ProjectGroup {
  project: ScopeRow | undefined;
  rows: WorklistRow[];
}

export const groupRowsByProject = (rows: WorklistRow[]): ProjectGroup[] => {
  const order: string[] = [];
  const byKey = new Map<string, ProjectGroup>();
  for (const row of rows) {
    const key = row.project?.key ?? '';
    if (!byKey.has(key)) {
      order.push(key);
      byKey.set(key, { project: row.project, rows: [] });
    }
    byKey.get(key)?.rows.push(row);
  }
  const rank = (group: ProjectGroup) => (!group.project || group.project.isCurrent ? 0 : 1);
  return order
    .map((key) => byKey.get(key) as ProjectGroup)
    .sort(
      (a, b) => rank(a) - rank(b) || (a.project?.name ?? '').localeCompare(b.project?.name ?? ''),
    );
};

const worklistSortProxy = (row: WorklistRow): WorklistEntry =>
  row.type === 'note'
    ? {
        ...row.entry,
        status: NOTE_STATUS_TIER[noteStatus(row.entry)],
        updated: undefined,
        phasesDone: 0,
        phasesTotal: 0,
      }
    : row.entry;

export const sortWorklistRows = (
  rows: WorklistRow[],
  sortKey: PlanSortKey,
  sortDirection: SortDirection,
): WorklistRow[] =>
  [...rows].sort((a, b) =>
    compareEntries(worklistSortProxy(a), worklistSortProxy(b), sortKey, sortDirection),
  );

export interface WorklistResult {
  rows: WorklistRow[];
  statusCounts: Record<PlanStatus, number>;
  tagCounts: Record<string, number>;
  noteStatusCounts: Record<IdeaStatus, number>;
}

export const deriveChildrenSummary = (
  children: WorklistEntry[],
): { done: number; total: number } | null => {
  if (children.length === 0) return null;
  return { done: children.filter((p) => p.status === 'done').length, total: children.length };
};

/** Every plan renders as its own row; notes surface alongside them. A fix renders
 * as its own row, grouped under the parent's subject, inherited here rather than
 * stored. A ticket never gets a row — it only renders inside its board's view. */
export const selectWorklistRows = (
  entries: WorklistEntry[],
  filters: PlanListFilters = DEFAULT_PLAN_LIST_FILTERS,
): WorklistResult => {
  const nonTicket = entries.filter((e) => e.kind !== 'ticket');
  const subjectById = new Map(nonTicket.map((e) => [e.id, e.subject] as const));
  const withInheritedSubject = nonTicket.map((e) =>
    e.kind === 'fix' ? { ...e, subject: (e.parent && subjectById.get(e.parent)) || undefined } : e,
  );
  const plans = withInheritedSubject.filter((e) => e.kind !== 'note');
  const fixes = plans.filter((e) => e.kind === 'fix');
  const nonFixPlans = plans.filter((e) => e.kind !== 'fix');
  const notes = withInheritedSubject.filter((e) => e.kind === 'note');

  const { statusCounts, tagCounts } = selectPlanRows(plans, filters);

  const noteStatusSet = new Set(filters.noteStatuses);
  const noteStatusCounts = countBy(
    notes.filter((note) => matchesSearch(note, filters.search)),
    (note) => [noteStatus(note)],
  ) as Record<IdeaStatus, number>;
  for (const status of IDEA_STATUSES) noteStatusCounts[status] ??= 0;

  const rows: WorklistRow[] = selectPlanRows(nonFixPlans, filters).rows.map(
    (entry): PlanRow => ({ type: 'plan', entry }),
  );
  rows.push(
    ...selectPlanRows(fixes, filters).rows.map((entry): FixRow => ({ type: 'fix', entry })),
  );

  for (const note of notes) {
    if (!noteStatusSet.has(noteStatus(note))) continue;
    if (!matchesSearch(note, filters.search)) continue;
    if (!matchesSubject(note.subject, filters.subject)) continue;
    rows.push({ type: 'note', entry: note });
  }

  return {
    rows: sortWorklistRows(rows, filters.sortKey, filters.sortDirection),
    statusCounts,
    tagCounts,
    noteStatusCounts,
  };
};
