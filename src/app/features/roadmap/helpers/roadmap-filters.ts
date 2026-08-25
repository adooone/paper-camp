import type {
  PlanStatus,
  ResolvedRoadmap,
  ResolvedRoadmapHorizon,
  ResolvedRoadmapItem,
} from '@/types/index';

export interface RoadmapFilters {
  horizons: string[];
  statuses: PlanStatus[];
}

export const DEFAULT_ROADMAP_FILTERS: RoadmapFilters = { horizons: [], statuses: [] };

export const itemStatuses = (item: ResolvedRoadmapItem): PlanStatus[] => [
  ...new Set(item.links.map((link) => link.status)),
];

const matchesStatusFilter = (item: ResolvedRoadmapItem, statuses: PlanStatus[]): boolean =>
  statuses.length === 0 || item.links.some((link) => statuses.includes(link.status));

const inHorizonFilter = (title: string, horizons: string[]): boolean =>
  horizons.length === 0 || horizons.includes(title);

export const filterHorizons = (
  roadmap: ResolvedRoadmap,
  filters: RoadmapFilters,
): ResolvedRoadmapHorizon[] =>
  roadmap.horizons
    .filter((horizon) => inHorizonFilter(horizon.title, filters.horizons))
    .map((horizon) => ({
      ...horizon,
      items: horizon.items.filter((item) => matchesStatusFilter(item, filters.statuses)),
    }));

export const horizonItemCounts = (
  roadmap: ResolvedRoadmap,
  filters: RoadmapFilters,
): Record<string, number> =>
  Object.fromEntries(
    roadmap.horizons.map((horizon) => [
      horizon.title,
      horizon.items.filter((item) => matchesStatusFilter(item, filters.statuses)).length,
    ]),
  );

export const statusItemCounts = (
  roadmap: ResolvedRoadmap,
  filters: RoadmapFilters,
): Partial<Record<PlanStatus, number>> => {
  const counts: Partial<Record<PlanStatus, number>> = {};
  for (const horizon of roadmap.horizons) {
    if (!inHorizonFilter(horizon.title, filters.horizons)) continue;
    for (const item of horizon.items) {
      for (const status of itemStatuses(item)) {
        counts[status] = (counts[status] ?? 0) + 1;
      }
    }
  }
  return counts;
};
