import {
  Button,
  Input,
  SidebarCard,
  SidebarField,
  SidebarItem,
  SidebarLabel,
  Stamp,
} from '@dendelion/paper-ui';
import { ITEM_STATE_STAMP } from './constants';
import { stripHorizonPrefix } from './helpers';
import { useRoadmapSidebar } from './hooks';

export const RoadmapSidebar = () => {
  const {
    roadmap,
    filters,
    horizonTitles,
    horizonCounts,
    statusCounts,
    activeHorizons,
    activeStatuses,
    visibleStatuses,
    hasActiveFilters,
    toggleRoadmapHorizon,
    toggleRoadmapStatus,
    setRoadmapSearch,
    clearRoadmapFilters,
  } = useRoadmapSidebar();

  if (!roadmap) return null;

  return (
    <SidebarCard className="shrink-0">
      <div className="flex flex-col">
        <SidebarField label="Search">
          <Input
            type="search"
            size="small"
            placeholder="Search roadmap…"
            aria-label="Search roadmap"
            value={filters.search}
            onChange={(event) => setRoadmapSearch(event.target.value)}
          />
        </SidebarField>

        <SidebarLabel>Horizon</SidebarLabel>
        <div className="flex flex-col">
          {horizonTitles.map((title) => (
            <SidebarItem
              key={title}
              active={activeHorizons.has(title)}
              onClick={() => toggleRoadmapHorizon(title)}
              count={horizonCounts[title] ?? 0}
            >
              {stripHorizonPrefix(title)}
            </SidebarItem>
          ))}
        </div>

        <SidebarLabel>Status</SidebarLabel>
        <div className="flex flex-col">
          {visibleStatuses.map((status) => (
            <SidebarItem
              key={status}
              active={activeStatuses.has(status)}
              onClick={() => toggleRoadmapStatus(status)}
              count={statusCounts[status] ?? 0}
            >
              <Stamp size="small" variant={ITEM_STATE_STAMP[status].variant}>
                {ITEM_STATE_STAMP[status].label}
              </Stamp>
            </SidebarItem>
          ))}
        </div>

        {hasActiveFilters && (
          <Button variant="link" onClick={clearRoadmapFilters} className="text-2xs opacity-70">
            Clear filters
          </Button>
        )}
      </div>
    </SidebarCard>
  );
};
