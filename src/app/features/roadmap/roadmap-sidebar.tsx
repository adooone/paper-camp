import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanStatus } from '@/types/index';
import { Button, ListItem } from '@dendelion/paper-ui';
import { useState } from 'react';
import { AddRoadmapItemModal } from './add-roadmap-item-modal';
import { horizonItemCounts, statusItemCounts } from './roadmap-filters';

const STATUS_CHIP_ORDER: PlanStatus[] = [
  'in-progress',
  'review',
  'planned',
  'idea',
  'done',
  'dropped',
];

const sectionLabelClass = 'text-2xs font-semibold tracking-[0.08em] uppercase text-ink-300 mb-2';

export const RoadmapSidebar = () => {
  const roadmap = useAppStore((s) => s.roadmap);
  const filters = useAppStore((s) => s.roadmapFilters);
  const toggleRoadmapHorizon = useAppStore((s) => s.toggleRoadmapHorizon);
  const toggleRoadmapStatus = useAppStore((s) => s.toggleRoadmapStatus);
  const [addOpen, setAddOpen] = useState(false);

  if (!roadmap) return null;

  const horizonTitles = roadmap.horizons.map((horizon) => horizon.title);
  const horizonCounts = horizonItemCounts(roadmap, filters);
  const statusCounts = statusItemCounts(roadmap, filters);
  const activeHorizons = new Set(filters.horizons);
  const activeStatuses = new Set(filters.statuses);
  const visibleStatuses = STATUS_CHIP_ORDER.filter(
    (status) => (statusCounts[status] ?? 0) > 0 || activeStatuses.has(status),
  );

  return (
    <div className="flex flex-col gap-8 -mt-5">
      <Button
        type="button"
        variant="primary"
        size="small"
        onClick={() => setAddOpen(true)}
        disabled={horizonTitles.length === 0}
      >
        + Add item
      </Button>

      <div>
        <div className={sectionLabelClass}>Horizon</div>
        <div className="flex flex-col gap-1">
          {horizonTitles.map((title) => (
            <ListItem
              key={title}
              size="small"
              active={activeHorizons.has(title)}
              onClick={() => toggleRoadmapHorizon(title)}
              className="text-xs leading-4 py-2"
              action={<span className="text-2xs text-ink-500">{horizonCounts[title] ?? 0}</span>}
            >
              {title}
            </ListItem>
          ))}
        </div>
      </div>

      <div>
        <div className={sectionLabelClass}>Status</div>
        <div className="flex flex-col gap-1">
          {visibleStatuses.length === 0 && (
            <span className="opacity-50 text-2xs">No linked ideas</span>
          )}
          {visibleStatuses.map((status) => (
            <ListItem
              key={status}
              size="small"
              active={activeStatuses.has(status)}
              onClick={() => toggleRoadmapStatus(status)}
              className="text-xs leading-4 py-2"
              icon={
                <span
                  className="w-[9px] h-[9px] rounded-full shrink-0"
                  style={{ background: STATUS_STAMP[status].text }}
                />
              }
              action={<span className="text-2xs text-ink-500">{statusCounts[status] ?? 0}</span>}
            >
              {STATUS_LABEL[status]}
            </ListItem>
          ))}
        </div>
      </div>

      <AddRoadmapItemModal
        open={addOpen}
        horizonTitles={horizonTitles}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
};
