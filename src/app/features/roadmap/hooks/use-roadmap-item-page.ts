import { useActiveRoadmapItem } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useParams } from '@tanstack/react-router';
import { ideaDateRange } from '../helpers';

export const useRoadmapItemPage = () => {
  const { item: itemParam } = useParams({ strict: false });
  const roadmap = useAppStore((s) => s.roadmap);
  const roadmapError = useAppStore((s) => s.roadmapError);
  const active = useActiveRoadmapItem();

  return {
    isItemRoute: typeof itemParam === 'string',
    roadmap,
    roadmapError,
    item: active?.item ?? null,
    horizonTitle: active?.horizonTitle ?? null,
    dateRange: active ? ideaDateRange(active.item.ideas) : null,
  };
};
