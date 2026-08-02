import { selectPlanRows } from '@/app/features/plans/helpers';
import { useActivePlanTitle } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanStatus } from '@/types/index';
import { Card, Input } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';

const VISIBLE_TAG_COUNT = 8;

const STATUS_CHIP_ORDER: PlanStatus[] = [
  'in-progress',
  'review',
  'planned',
  'idea',
  'done',
  'dropped',
];

/** "Backlog" (not STATUS_LABEL's "Idea") for idea-status plans — this list's own term. */
const STATUS_CHIP_LABEL: Record<PlanStatus, string> = { ...STATUS_LABEL, idea: 'Backlog' };

const sectionLabelClass = 'text-2xs font-semibold tracking-[0.08em] uppercase text-ink-300 mb-2';

export const PlanFilterColumn = () => {
  const plans = useAppStore((s) => s.plans);
  const activePlanTitle = useActivePlanTitle();
  const filters = useAppStore((s) => s.planFilters);
  const togglePlanStatus = useAppStore((s) => s.togglePlanStatus);
  const togglePlanTag = useAppStore((s) => s.togglePlanTag);
  const setPlanSearch = useAppStore((s) => s.setPlanSearch);
  const setSubjectFilter = useAppStore((s) => s.setSubjectFilter);
  const navigate = useNavigate();
  const [tagsExpanded, setTagsExpanded] = useState(false);

  if (!plans || activePlanTitle) return null;

  const { statusCounts, tagCounts } = selectPlanRows(plans.entries, filters);
  const activeStatuses = new Set(filters.statuses);
  const activeTags = new Set(filters.tags);

  const allTags = new Set([...Object.keys(tagCounts), ...filters.tags]);
  const sortedTags = [...allTags].sort((a, b) => {
    const byCount = (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0);
    return byCount !== 0 ? byCount : a.localeCompare(b);
  });
  const visibleTags = tagsExpanded ? sortedTags : sortedTags.slice(0, VISIBLE_TAG_COUNT);
  const hiddenCount = sortedTags.length - visibleTags.length;

  const linkClass =
    'bg-none bg-transparent border-none p-0 cursor-pointer opacity-70 underline text-2xs';

  return (
    // Pull up by the SidebarShell's top padding to line up with the Page.
    <div className="-mt-5">
      <Card surface="paper" texture="speckle" size="small">
        <div className="flex flex-col gap-5">
          <h2 className="m-0 font-display-luminari text-base text-ink-900">Filters</h2>

          <Input
            type="search"
            size="small"
            placeholder="Search plans…"
            aria-label="Search plans"
            value={filters.search}
            onChange={(event) => setPlanSearch(event.target.value)}
          />

          {filters.subject !== null && (
            <div className="flex items-center gap-2" data-testid="subject-filter-chip">
              <span className="text-2xs opacity-70">Subject: {filters.subject}</span>
              <button
                type="button"
                onClick={() => {
                  setSubjectFilter(null);
                  navigate({ to: '/', search: {} });
                }}
                className={linkClass}
              >
                Clear
              </button>
            </div>
          )}

          <div>
            <div className={sectionLabelClass}>Status</div>
            <div className="flex flex-col gap-1">
              {STATUS_CHIP_ORDER.map((status) => {
                const isActive = activeStatuses.has(status);
                return (
                  // Raw <button>: paper-ui Button draws its own filled/washed chrome.
                  <button
                    key={status}
                    type="button"
                    onClick={() => togglePlanStatus(status)}
                    aria-pressed={isActive}
                    className={`flex items-center gap-2 w-full px-2 py-1 rounded-md border-none cursor-pointer text-left ${
                      isActive ? 'bg-black/[5%] opacity-100' : 'bg-transparent opacity-50'
                    }`}
                  >
                    <span
                      className="w-[9px] h-[9px] rounded-full shrink-0"
                      style={{ background: STATUS_STAMP[status].text }}
                    />
                    <span className="flex-1 text-xs text-ink-900">{STATUS_CHIP_LABEL[status]}</span>
                    <span className="text-2xs text-ink-500">{statusCounts[status]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className={sectionLabelClass}>Tags</div>
            <div className="flex flex-wrap gap-1 items-center">
              {sortedTags.length === 0 && <span className="opacity-50 text-2xs">No tags</span>}
              {visibleTags.map((tag) => {
                const isActive = activeTags.has(tag);
                return (
                  // Raw <button>: paper-ui Button doesn't offer this border/background treatment.
                  <button
                    key={tag}
                    type="button"
                    onClick={() => togglePlanTag(tag)}
                    aria-pressed={isActive}
                    className={`text-2xs px-2 py-[2px] rounded-md border-[0.5px] border-black/[12%] cursor-pointer ${
                      isActive ? 'bg-black/[8%] opacity-100' : 'bg-transparent opacity-55'
                    }`}
                  >
                    {tag} {tagCounts[tag] ?? 0}
                  </button>
                );
              })}
              {/* Raw <button>: needs a muted opacity/font-size LinkButton's fixed amber style can't give. */}
              {hiddenCount > 0 && (
                <button type="button" onClick={() => setTagsExpanded(true)} className={linkClass}>
                  +{hiddenCount} more
                </button>
              )}
              {tagsExpanded && sortedTags.length > VISIBLE_TAG_COUNT && (
                <button type="button" onClick={() => setTagsExpanded(false)} className={linkClass}>
                  Show less
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
