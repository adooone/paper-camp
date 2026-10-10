import { useAppStore } from '@/app/stores/app-store';
import { horizonItemCounts } from '../helpers';

export const useRoadmapSidebar = () => {
  const roadmap = useAppStore((s) => s.roadmap);
  const filters = useAppStore((s) => s.roadmapFilters);
  const toggleRoadmapHorizon = useAppStore((s) => s.toggleRoadmapHorizon);
  const setRoadmapSearch = useAppStore((s) => s.setRoadmapSearch);
  const clearRoadmapFilters = useAppStore((s) => s.clearRoadmapFilters);

  const horizonTitles = roadmap?.horizons.map((horizon) => horizon.title) ?? [];
  const horizonCounts = roadmap ? horizonItemCounts(roadmap, filters) : {};
  const activeHorizons = new Set(filters.horizons);
  const hasActiveFilters = filters.horizons.length > 0 || filters.search !== '';

  return {
    roadmap,
    filters,
    horizonTitles,
    horizonCounts,
    activeHorizons,
    hasActiveFilters,
    toggleRoadmapHorizon,
    setRoadmapSearch,
    clearRoadmapFilters,
  };
};
