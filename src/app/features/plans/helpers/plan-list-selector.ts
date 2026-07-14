import type { IdeaEntry, IdeaStatus, PlanEntry, PlanStatus } from '@/types/index';
import { PLAN_STATUSES } from '@/types/index';
import { phasePercentage } from './helpers';

export type PlanSortKey = 'status' | 'updated' | 'created' | 'title' | 'id' | 'progress';
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
  sortKey: 'status',
  sortDirection: 'asc',
  noteStatuses: DEFAULT_VISIBLE_NOTE_STATUSES,
};

/** in-progress -> review -> planned -> backlog(idea) -> done -> dropped, per FEAT-41. */
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

/**
 * Ascending order matches how each key reads naturally (precedence order for
 * status, most-recent-first for dates, highest-progress-first): `sortDirection`
 * flips the sign rather than redefining "natural" per key.
 */
const comparePlans = (a: PlanEntry, b: PlanEntry, key: PlanSortKey): number => {
  switch (key) {
    case 'status': {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      return updatedTimestamp(b) - updatedTimestamp(a);
    }
    case 'updated':
      return updatedTimestamp(b) - updatedTimestamp(a);
    case 'created':
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    case 'title':
      return a.title.localeCompare(b.title);
    case 'id':
      return idNumber(a) - idNumber(b);
    case 'progress':
      return (phasePercentage(b) ?? -1) - (phasePercentage(a) ?? -1);
    default:
      return 0;
  }
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

/**
 * Factored out of list-view.tsx so the idea-grouped tree can reuse the same
 * filtering/sorting/counting logic over the flat plans.entries array.
 */
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
    .sort((a, b) => {
      const cmp = comparePlans(a, b, filters.sortKey);
      return filters.sortDirection === 'desc' ? -cmp : cmp;
    });

  return { rows, statusCounts, tagCounts };
};

const IDEA_STATUSES: IdeaStatus[] = ['open', 'done', 'dropped'];

/**
 * Notes carry no phases/plan work, so they have no natural PlanStatus. Open
 * sits at the same backlog tier as an undrafted idea; done/dropped reuse the
 * plan tiers of the same name — this lets the merged worklist sort reuse a
 * single STATUS_ORDER instead of a parallel one for notes.
 */
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

export interface WorklistResult {
  rows: WorklistRow[];
  statusCounts: Record<PlanStatus, number>;
  tagCounts: Record<string, number>;
  noteStatusCounts: Record<IdeaStatus, number>;
}

/**
 * "2/3 plans done" for a group's row-card summary; null before any plan is
 * drafted, when the row shows a Draft-plan action instead of a summary.
 */
export const deriveChildrenSummary = (
  children: PlanEntry[],
): { done: number; total: number } | null => {
  if (children.length === 0) return null;
  return { done: children.filter((p) => p.status === 'done').length, total: children.length };
};

/**
 * A plan-shaped stand-in used only to compare a group/note row against
 * ordinary plan rows under whichever PlanSortKey is active. Title/id stay the
 * idea's own identity (so alphabetical/id sorts read as "the idea"), while
 * status/updated/created/progress come from the group's most-advanced child
 * per FEAT-42, falling back to the undrafted/note tier when there isn't one.
 */
const worklistSortProxy = (row: WorklistRow): PlanEntry => {
  if (row.type === 'plan') return row.plan;

  if (row.type === 'note') {
    return {
      title: row.idea.title,
      id: row.idea.id ?? undefined,
      status: NOTE_STATUS_TIER[row.idea.status ?? 'open'],
      created: '',
      tags: [],
      body: row.idea.body,
      phases: [],
    };
  }

  const mostAdvanced =
    row.children.length > 0
      ? [...row.children].sort((a, b) => comparePlans(a, b, 'status'))[0]
      : undefined;

  return {
    ...(mostAdvanced ?? {
      status: 'idea' as const,
      created: '',
      tags: [],
      body: row.idea.body,
      phases: [],
    }),
    title: row.idea.title,
    id: row.idea.id ?? undefined,
  };
};

/**
 * Extends selectPlanRows into FEAT-42's two-level worklist tree: a plan whose
 * `idea:` backlink points at a plan-bearing idea nests under that idea as a
 * group (idea parents with derived children summaries); every other plan
 * stays top-level (orphan plans); `kind: note` ideas surface as their own
 * rows gated by a separate `noteStatuses` filter. Nesting stops at this one
 * level — a group's children are never themselves grouped. Status/tag chips
 * only ever describe PlanStatus, so an idea with no plans yet is gated by
 * search alone, not by the statuses/tags filters.
 */
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
      // A plan-bearing idea with plans that all got filtered out (e.g. every
      // child is done and the done chip is off) hides entirely, same as a
      // top-level plan would. Only a genuinely undrafted idea (no plans yet)
      // falls back to the search filter, so it can still surface as an empty
      // group with a Draft-plan action.
      if (allChildren.length > 0 || !matchesIdeaSearch(idea, filters.search)) continue;
    }
    rows.push({ type: 'idea-group', idea, children: filteredChildren });
  }

  for (const idea of notes) {
    if (!noteStatusSet.has(idea.status ?? 'open')) continue;
    if (!matchesIdeaSearch(idea, filters.search)) continue;
    rows.push({ type: 'note', idea });
  }

  rows.sort((a, b) => {
    const cmp = comparePlans(worklistSortProxy(a), worklistSortProxy(b), filters.sortKey);
    return filters.sortDirection === 'desc' ? -cmp : cmp;
  });

  return { rows, statusCounts, tagCounts, noteStatusCounts };
};
