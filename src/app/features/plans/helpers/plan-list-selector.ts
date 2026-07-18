import type { IdeaEntry, IdeaStatus, PlanEntry, PlanStatus } from '@/types/index';
import { PLAN_STATUSES } from '@/types/index';
import { phasePercentage } from './helpers';

export type PlanSortKey = 'status' | 'updated' | 'title' | 'id' | 'progress' | 'order';
type SortDirection = 'asc' | 'desc';

export interface PlanListFilters {
  statuses: PlanStatus[];
  tags: string[];
  search: string;
  sortKey: PlanSortKey;
  sortDirection: SortDirection;
  /** Filter chip for `kind: note` ideas — separate lifecycle from PlanStatus. */
  noteStatuses: IdeaStatus[];
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
};

const STATUS_ORDER: Record<PlanStatus, number> = {
  'in-progress': 0,
  review: 1,
  planned: 2,
  idea: 3,
  done: 4,
  dropped: 5,
};

export interface PlanListResult {
  rows: PlanEntry[];
  statusCounts: Record<PlanStatus, number>;
  tagCounts: Record<string, number>;
}

const updatedTimestamp = (plan: PlanEntry): number => {
  const parsed = new Date(plan.updated ?? plan.created).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const createdTimestamp = (plan: PlanEntry): number => {
  const parsed = new Date(plan.created).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const idNumber = (plan: PlanEntry): number => {
  const match = plan.id?.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const matchesSearch = (plan: PlanEntry, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return plan.title.toLowerCase().includes(needle) || plan.body.toLowerCase().includes(needle);
};

const matchesTags = (plan: PlanEntry, tags: Set<string>): boolean => {
  if (tags.size === 0) return true;
  return plan.tags.some((tag) => tags.has(tag));
};

/** `sortDirection` flips the sign rather than redefining "natural" per key, except
 * for `order`, where unordered rows must stay last regardless of direction. */
const comparePlans = (
  a: PlanEntry,
  b: PlanEntry,
  key: PlanSortKey,
  direction: SortDirection = 'asc',
): number => {
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
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
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
        return (phasePercentage(b) ?? -1) - (phasePercentage(a) ?? -1);
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
  entries: PlanEntry[],
  filters: PlanListFilters = DEFAULT_PLAN_LIST_FILTERS,
): PlanListResult => {
  const tagSet = new Set(filters.tags);
  const statusSet = new Set(filters.statuses);

  // Status/tag counts reflect every other active filter dimension (so a chip
  // shows the count it would have if you enabled it), but not themselves.
  const statusCounts = countBy(
    entries.filter((plan) => matchesTags(plan, tagSet) && matchesSearch(plan, filters.search)),
    (plan) => [plan.status],
  ) as Record<PlanStatus, number>;
  for (const status of PLAN_STATUSES) statusCounts[status] ??= 0;

  const tagCounts = countBy(
    entries.filter((plan) => statusSet.has(plan.status) && matchesSearch(plan, filters.search)),
    (plan) => plan.tags,
  );

  const rows = entries
    .filter(
      (plan) =>
        statusSet.has(plan.status) &&
        matchesTags(plan, tagSet) &&
        matchesSearch(plan, filters.search),
    )
    .sort((a, b) => comparePlans(a, b, filters.sortKey, filters.sortDirection));

  return { rows, statusCounts, tagCounts };
};

const IDEA_STATUSES: IdeaStatus[] = ['open', 'done', 'dropped'];

/** Maps a note's own lifecycle onto PlanStatus tiers so the merged worklist
 * sort can reuse a single STATUS_ORDER instead of a parallel one for notes. */
const NOTE_STATUS_TIER: Record<IdeaStatus, PlanStatus> = {
  open: 'idea',
  done: 'done',
  dropped: 'dropped',
};

const matchesIdeaSearch = (idea: IdeaEntry, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return idea.title.toLowerCase().includes(needle) || idea.body.toLowerCase().includes(needle);
};

export interface IdeaGroupRow {
  type: 'idea-group';
  idea: IdeaEntry;
  children: PlanEntry[];
}

export interface NoteRow {
  type: 'note';
  idea: IdeaEntry;
}

interface PlanRow {
  type: 'plan';
  plan: PlanEntry;
}

export type WorklistRow = IdeaGroupRow | NoteRow | PlanRow;

export interface SubjectGroup {
  /** null is the virtual "No subject" group. */
  subject: string | null;
  rows: WorklistRow[];
}

const subjectOf = (row: WorklistRow): string | undefined =>
  row.type === 'plan' ? row.plan.subject : row.idea.subject;

/** Groups already-sorted worklist rows by subject, keeping each row's relative
 * order; rows with no subject collect into the virtual "No subject" group, last.
 * When `validSubjects` is given, a row whose subject isn't in it (e.g. removed
 * from Settings) demotes to "No subject" without touching the idea file. */
export const groupRowsBySubject = (
  rows: WorklistRow[],
  validSubjects?: string[],
): SubjectGroup[] => {
  const order: string[] = [];
  const bySubject = new Map<string, WorklistRow[]>();
  const noSubject: WorklistRow[] = [];

  for (const row of rows) {
    const subject = subjectOf(row);
    if (!subject || (validSubjects && !validSubjects.includes(subject))) {
      noSubject.push(row);
      continue;
    }
    if (!bySubject.has(subject)) {
      order.push(subject);
      bySubject.set(subject, []);
    }
    bySubject.get(subject)?.push(row);
  }

  const groups: SubjectGroup[] = order.map((subject) => ({
    subject,
    rows: bySubject.get(subject) ?? [],
  }));
  if (noSubject.length > 0) groups.push({ subject: null, rows: noSubject });
  return groups;
};

export interface WorklistResult {
  rows: WorklistRow[];
  statusCounts: Record<PlanStatus, number>;
  tagCounts: Record<string, number>;
  noteStatusCounts: Record<IdeaStatus, number>;
}

/** Null before any plan is drafted, when the row shows a Draft-plan action instead. */
export const deriveChildrenSummary = (
  children: PlanEntry[],
): { done: number; total: number } | null => {
  if (children.length === 0) return null;
  return { done: children.filter((p) => p.status === 'done').length, total: children.length };
};

/** Title/id stay the idea's own identity; status/updated/progress come from
 * the group's most-advanced child, falling back to the undrafted/note tier. */
const worklistSortProxy = (row: WorklistRow): PlanEntry => {
  if (row.type === 'plan') return row.plan;

  if (row.type === 'note') {
    return {
      title: row.idea.title,
      id: row.idea.id ?? undefined,
      status: NOTE_STATUS_TIER[row.idea.status ?? 'open'],
      created: row.idea.created ?? '',
      tags: [],
      body: row.idea.body,
      phases: [],
      order: row.idea.order,
    };
  }

  const mostAdvanced =
    row.children.length > 0
      ? [...row.children].sort((a, b) => comparePlans(a, b, 'status'))[0]
      : undefined;

  return {
    ...(mostAdvanced ?? {
      status: 'idea' as const,
      created: row.idea.created ?? '',
      tags: [],
      body: row.idea.body,
      phases: [],
    }),
    title: row.idea.title,
    id: row.idea.id ?? undefined,
    order: row.idea.order,
  };
};

/** Nests a plan under its `idea:` backlink as a group; other plans and
 * `kind: note` ideas stay top-level. Nesting stops at this one level. */
export const selectWorklistRows = (
  plans: PlanEntry[],
  ideas: IdeaEntry[],
  filters: PlanListFilters = DEFAULT_PLAN_LIST_FILTERS,
): WorklistResult => {
  const { statusCounts, tagCounts } = selectPlanRows(plans, filters);

  const notes = ideas.filter((idea) => idea.kind === 'note');
  const ideaParents = ideas.filter((idea) => idea.kind !== 'note');
  const ideaParentIds = new Set(
    ideaParents.map((idea) => idea.id).filter((id): id is string => Boolean(id)),
  );

  const childrenByIdea = new Map<string, PlanEntry[]>();
  const orphanPlans: PlanEntry[] = [];
  for (const p of plans) {
    if (p.idea && ideaParentIds.has(p.idea)) {
      const list = childrenByIdea.get(p.idea) ?? [];
      list.push(p);
      childrenByIdea.set(p.idea, list);
    } else {
      orphanPlans.push(p);
    }
  }

  const noteStatusSet = new Set(filters.noteStatuses);
  const noteStatusCounts = countBy(
    notes.filter((idea) => matchesIdeaSearch(idea, filters.search)),
    (idea) => [idea.status ?? 'open'],
  ) as Record<IdeaStatus, number>;
  for (const status of IDEA_STATUSES) noteStatusCounts[status] ??= 0;

  const rows: WorklistRow[] = selectPlanRows(orphanPlans, filters).rows.map(
    (plan): PlanRow => ({ type: 'plan', plan }),
  );

  for (const idea of ideaParents) {
    const allChildren = idea.id ? (childrenByIdea.get(idea.id) ?? []) : [];
    const filteredChildren = selectPlanRows(allChildren, filters).rows;
    if (filteredChildren.length === 0) {
      // Only a genuinely undrafted idea (no plans yet) falls back to search alone.
      if (allChildren.length > 0 || !matchesIdeaSearch(idea, filters.search)) continue;
    }
    rows.push({ type: 'idea-group', idea, children: filteredChildren });
  }

  for (const idea of notes) {
    if (!noteStatusSet.has(idea.status ?? 'open')) continue;
    if (!matchesIdeaSearch(idea, filters.search)) continue;
    rows.push({ type: 'note', idea });
  }

  rows.sort((a, b) =>
    comparePlans(
      worklistSortProxy(a),
      worklistSortProxy(b),
      filters.sortKey,
      filters.sortDirection,
    ),
  );

  return { rows, statusCounts, tagCounts, noteStatusCounts };
};
