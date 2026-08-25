import { useAppStore } from '@/app/stores/app-store';
import type { PlanStatus } from '@/types/index';
import { useState } from 'react';
import { horizonItemCounts, statusItemCounts } from '../helpers';

const STATUS_CHIP_ORDER: PlanStatus[] = [
  'in-progress',
  'review',
  'planned',
  'idea',
  'done',
  'dropped',
];

export const useRoadmapSidebar = () => {
  const roadmap = useAppStore((s) => s.roadmap);
  const filters = useAppStore((s) => s.roadmapFilters);
  const toggleRoadmapHorizon = useAppStore((s) => s.toggleRoadmapHorizon);
  const toggleRoadmapStatus = useAppStore((s) => s.toggleRoadmapStatus);
  const [addOpen, setAddOpen] = useState(false);

  const horizonTitles = roadmap?.horizons.map((horizon) => horizon.title) ?? [];
  const horizonCounts = roadmap ? horizonItemCounts(roadmap, filters) : {};
  const statusCounts = roadmap ? statusItemCounts(roadmap, filters) : {};
  const activeHorizons = new Set(filters.horizons);
  const activeStatuses = new Set(filters.statuses);
  const visibleStatuses = STATUS_CHIP_ORDER.filter(
    (status) => (statusCounts[status] ?? 0) > 0 || activeStatuses.has(status),
  );

  return {
    roadmap,
    horizonTitles,
    horizonCounts,
    statusCounts,
    activeHorizons,
    activeStatuses,
    visibleStatuses,
    addOpen,
    setAddOpen,
    toggleRoadmapHorizon,
    toggleRoadmapStatus,
  };
};
