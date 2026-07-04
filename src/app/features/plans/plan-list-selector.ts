import type { PlanEntry, PlanStatus } from '@/types/index';
import { PLAN_STATUSES } from '@/types/index';
import { phasePercentage } from './helpers';

export type PlanSortKey = 'status' | 'updated' | 'created' | 'title' | 'id' | 'progress';
export type SortDirection = 'asc' | 'desc';

export interface PlanListFilters {
  statuses: PlanStatus[];
  tags: string[];
  search: string;
  sortKey: PlanSortKey;
  sortDirection: SortDirection;
}

/** Excludes done/dropped so 40+ closed plans stay out of first paint until a chip reveals them. */
export const DEFAULT_VISIBLE_STATUSES: PlanStatus[] = ['in-progress', 'review', 'planned', 'idea'];

export const DEFAULT_PLAN_LIST_FILTERS: PlanListFilters = {
  statuses: DEFAULT_VISIBLE_STATUSES,
  tags: [],
  search: '',
  sortKey: 'status',
  sortDirection: 'asc',
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

const countBy = <T>(plans: PlanEntry[], key: (plan: PlanEntry) => T[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const plan of plans) {
    for (const value of key(plan)) {
      counts[String(value)] = (counts[String(value)] ?? 0) + 1;
    }
  }
  return counts;
};

/**
 * Factored out of list-view.tsx so IDEA-43's idea-grouped tree can reuse the
 * same filtering/sorting/counting logic over the flat plans.entries array.
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
