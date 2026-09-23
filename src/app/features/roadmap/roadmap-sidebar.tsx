import { SidebarCard } from '@/app/components/sidebar';
import { SidebarField, SidebarLabel } from '@/app/components/sidebar';
import { Button, Input, ListItem, Stamp } from '@dendelion/paper-ui';
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
    <SidebarCard>
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
            <ListItem
              key={title}
              size="small"
              active={activeHorizons.has(title)}
              onClick={() => toggleRoadmapHorizon(title)}
              className="pc-row text-xs"
              action={<span className="text-2xs text-ink-500">{horizonCounts[title] ?? 0}</span>}
            >
              {stripHorizonPrefix(title)}
            </ListItem>
          ))}
        </div>

        <SidebarLabel>Status</SidebarLabel>
        <div className="flex flex-col">
          {visibleStatuses.map((status) => (
            <ListItem
              key={status}
              size="small"
              active={activeStatuses.has(status)}
              onClick={() => toggleRoadmapStatus(status)}
              className="pc-row text-xs"
              action={<span className="text-2xs text-ink-500">{statusCounts[status] ?? 0}</span>}
            >
              {/* Negative margin: a stamp is taller than the row's text line and drops the count. */}
              <span className="-my-1 inline-flex items-center">
                <Stamp size="small" variant={ITEM_STATE_STAMP[status].variant}>
                  {ITEM_STATE_STAMP[status].label}
                </Stamp>
              </span>
            </ListItem>
          ))}
        </div>

        {hasActiveFilters && (
          <Button
            variant="link"
            onClick={clearRoadmapFilters}
            className="pc-row-label text-2xs opacity-70"
          >
            Clear filters
          </Button>
        )}
      </div>
    </SidebarCard>
  );
};
