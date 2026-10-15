import {
  DEFAULT_ROADMAP_FILTERS,
  type RoadmapFilters,
} from '@/app/features/roadmap/helpers/roadmap-filters';
import type { ResolvedRoadmap } from '@/types/index';
import { fetchRoadmap } from '../../services/content/docs-api';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export function createInitialRoadmapState() {
  return {
    roadmap: null as ResolvedRoadmap | null,
    roadmapLoading: false,
    roadmapError: null as string | null,
    roadmapFilters: DEFAULT_ROADMAP_FILTERS,
  };
}

export type RoadmapSlice = {
  roadmap: ResolvedRoadmap | null;
  roadmapLoading: boolean;
  roadmapError: string | null;
  loadRoadmap: () => Promise<void>;

  // Lifted here (not local page state) so the router-level sidebar and the list share one source.
  roadmapFilters: RoadmapFilters;
  toggleRoadmapHorizon: (title: string) => void;
  setRoadmapSearch: (search: string) => void;
  clearRoadmapFilters: () => void;
};

export function createRoadmapSlice(set: SetState, _get: GetState): RoadmapSlice {
  return {
    ...createInitialRoadmapState(),
    loadRoadmap: loadSlice(
      set,
      fetchRoadmap,
      (data) => ({ roadmap: data, roadmapError: null }),
      (err) => ({ roadmapError: String(err) }),
      'roadmapLoading',
    ),

    toggleRoadmapHorizon: (title) =>
      set((s) => ({
        roadmapFilters: {
          ...s.roadmapFilters,
          horizons: s.roadmapFilters.horizons.includes(title)
            ? s.roadmapFilters.horizons.filter((x) => x !== title)
            : [...s.roadmapFilters.horizons, title],
        },
      })),
    setRoadmapSearch: (search) => set((s) => ({ roadmapFilters: { ...s.roadmapFilters, search } })),
    clearRoadmapFilters: () => set({ roadmapFilters: DEFAULT_ROADMAP_FILTERS }),
  };
}
