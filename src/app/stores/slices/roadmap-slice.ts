import {
  DEFAULT_ROADMAP_FILTERS,
  type RoadmapFilters,
} from '@/app/features/roadmap/helpers/roadmap-filters';
import type { PlanStatus, ResolvedRoadmap } from '@/types/index';
import { fetchRoadmap } from '../../services/content/docs-api';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type RoadmapSlice = {
  roadmap: ResolvedRoadmap | null;
  roadmapLoading: boolean;
  roadmapError: string | null;
  loadRoadmap: () => Promise<void>;

  // Lifted here (not local page state) so the router-level sidebar and the list share one source.
  roadmapFilters: RoadmapFilters;
  toggleRoadmapHorizon: (title: string) => void;
  toggleRoadmapStatus: (status: PlanStatus) => void;
};

export function createRoadmapSlice(set: SetState, _get: GetState): RoadmapSlice {
  return {
    roadmap: null,
    roadmapLoading: false,
    roadmapError: null,
    loadRoadmap: loadSlice(
      set,
      fetchRoadmap,
      (data) => ({ roadmap: data, roadmapError: null }),
      (err) => ({ roadmapError: String(err) }),
      'roadmapLoading',
    ),

    roadmapFilters: DEFAULT_ROADMAP_FILTERS,
    toggleRoadmapHorizon: (title) =>
      set((s) => ({
        roadmapFilters: {
          ...s.roadmapFilters,
          horizons: s.roadmapFilters.horizons.includes(title)
            ? s.roadmapFilters.horizons.filter((x) => x !== title)
            : [...s.roadmapFilters.horizons, title],
        },
      })),
    toggleRoadmapStatus: (status) =>
      set((s) => ({
        roadmapFilters: {
          ...s.roadmapFilters,
          statuses: s.roadmapFilters.statuses.includes(status)
            ? s.roadmapFilters.statuses.filter((x) => x !== status)
            : [...s.roadmapFilters.statuses, status],
        },
      })),
  };
}
