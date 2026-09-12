import { SidebarField, SidebarLabel } from '@/app/components/sidebar';
import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import { Input, ListItem } from '@dendelion/paper-ui';
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
            {title}
          </ListItem>
        ))}
      </div>

      <SidebarLabel>Status</SidebarLabel>
      <div className="flex flex-col">
        {visibleStatuses.length === 0 && (
          <span className="opacity-50 text-2xs">No linked ideas</span>
        )}
        {visibleStatuses.map((status) => (
          <ListItem
            key={status}
            size="small"
            active={activeStatuses.has(status)}
            onClick={() => toggleRoadmapStatus(status)}
            className="pc-row text-xs"
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

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearRoadmapFilters}
          className="pc-row-label text-2xs opacity-70 underline text-left"
        >
          Clear filters
        </button>
      )}
    </div>
  );
};
