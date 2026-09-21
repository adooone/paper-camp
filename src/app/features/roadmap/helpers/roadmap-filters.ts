import type {
  ResolvedRoadmap,
  ResolvedRoadmapHorizon,
  ResolvedRoadmapItem,
  RoadmapItemState,
} from '@/types/index';

export interface RoadmapFilters {
  horizons: string[];
  statuses: RoadmapItemState[];
  search: string;
}

export const DEFAULT_ROADMAP_FILTERS: RoadmapFilters = { horizons: [], statuses: [], search: '' };

const matchesStatusFilter = (item: ResolvedRoadmapItem, statuses: RoadmapItemState[]): boolean =>
  statuses.length === 0 || statuses.includes(item.state);

const inHorizonFilter = (title: string, horizons: string[]): boolean =>
  horizons.length === 0 || horizons.includes(title);

const matchesSearchFilter = (item: ResolvedRoadmapItem, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    item.name.toLowerCase().includes(needle) ||
    item.description.toLowerCase().includes(needle) ||
    item.candidates.some((candidate) => candidate.toLowerCase().includes(needle))
  );
};

const matchesItemFilters = (item: ResolvedRoadmapItem, filters: RoadmapFilters): boolean =>
  matchesStatusFilter(item, filters.statuses) && matchesSearchFilter(item, filters.search);

export const filterHorizons = (
  roadmap: ResolvedRoadmap,
  filters: RoadmapFilters,
): ResolvedRoadmapHorizon[] =>
  roadmap.horizons
    .filter((horizon) => inHorizonFilter(horizon.title, filters.horizons))
    .map((horizon) => ({
      ...horizon,
      items: horizon.items.filter((item) => matchesItemFilters(item, filters)),
    }));

export const horizonItemCounts = (
  roadmap: ResolvedRoadmap,
  filters: RoadmapFilters,
): Record<string, number> =>
  Object.fromEntries(
    roadmap.horizons.map((horizon) => [
      horizon.title,
      horizon.items.filter((item) => matchesItemFilters(item, filters)).length,
    ]),
  );

export const statusItemCounts = (
  roadmap: ResolvedRoadmap,
  filters: RoadmapFilters,
): Partial<Record<RoadmapItemState, number>> => {
  const counts: Partial<Record<RoadmapItemState, number>> = {};
  for (const horizon of roadmap.horizons) {
    if (!inHorizonFilter(horizon.title, filters.horizons)) continue;
    for (const item of horizon.items) {
      if (!matchesSearchFilter(item, filters.search)) continue;
      counts[item.state] = (counts[item.state] ?? 0) + 1;
    }
  }
  return counts;
};
