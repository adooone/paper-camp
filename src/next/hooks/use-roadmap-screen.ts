import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/app/stores/app-store';
import type { ResolvedRoadmap } from '@/types/index';

export interface RoadmapScreenState {
  load: 'loading' | 'unreachable' | 'missing' | 'ready';
  roadmap: ResolvedRoadmap | null;
  search: string;
  setSearch: (search: string) => void;
  reload: () => Promise<void>;
}

export function useRoadmapScreen(): RoadmapScreenState {
  const roadmap = useAppStore((state) => state.roadmap);
  const roadmapError = useAppStore((state) => state.roadmapError);
  const filters = useAppStore((state) => state.roadmapFilters);
  const loadRoadmap = useAppStore((state) => state.loadRoadmap);
  const setSearch = useAppStore((state) => state.setRoadmapSearch);

  const [settled, setSettled] = useState(false);

  useEffect(() => {
    void loadRoadmap().finally(() => setSettled(true));
  }, [loadRoadmap]);

  return useMemo(
    () => ({
      load: roadmap ? 'ready' : roadmapError ? 'unreachable' : settled ? 'missing' : 'loading',
      roadmap,
      search: filters.search,
      setSearch,
      reload: loadRoadmap,
    }),
    [roadmap, roadmapError, settled, filters.search, setSearch, loadRoadmap],
  );
}
