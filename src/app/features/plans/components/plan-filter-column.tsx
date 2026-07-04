import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { PlanStatus } from '@/types/index';
import { Card, Input } from '@dendelion/paper-ui';
import { useState } from 'react';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';
import { selectPlanRows } from '../plan-list-selector';

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

const sectionLabelStyle: React.CSSProperties = {
  fontSize: fontSize['2xs'],
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: color.textTertiary,
  margin: `0 0 ${space[2]}`,
};

/**
 * The plans-list filters as a paper-texture "Filters" card, rendered in the router's
 * sidebar slot for `/` so it sits beside the list. Filter state lives in the store
 * (planFilters) so this card and the list stay in sync across the two subtrees. The
 * title, toolbar, and sort control live in the page header instead. Hidden while a
 * plan detail is open.
 */
export const PlanFilterColumn = () => {
  const plans = useAppStore((s) => s.plans);
  const activePlanTitle = useAppStore((s) => s.activePlanTitle);
  const filters = useAppStore((s) => s.planFilters);
  const togglePlanStatus = useAppStore((s) => s.togglePlanStatus);
  const togglePlanTag = useAppStore((s) => s.togglePlanTag);
  const setPlanSearch = useAppStore((s) => s.setPlanSearch);
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

  const linkStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    opacity: 0.7,
    textDecoration: 'underline',
    fontSize: fontSize['2xs'],
  };

  return (
    // Pull up by the SidebarShell's top padding so the card's top edge lines up
    // with the Page surface (which starts flush at the top of the content row).
    <div style={{ marginTop: `calc(-1 * ${space[5]})` }}>
      <Card surface="paper" texture="paper" size="small">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
          <h2
            style={{
              margin: 0,
              fontFamily: fontFamily.serif,
              fontSize: fontSize.base,
              color: color.textPrimary,
            }}
          >
            Filters
          </h2>

          <Input
            type="search"
            size="small"
            placeholder="Search plans…"
            aria-label="Search plans"
            value={filters.search}
            onChange={(event) => setPlanSearch(event.target.value)}
          />

          <div>
            <div style={sectionLabelStyle}>Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
              {STATUS_CHIP_ORDER.map((status) => {
                const isActive = activeStatuses.has(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => togglePlanStatus(status)}
                    aria-pressed={isActive}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: space[2],
                      width: '100%',
                      padding: `${space[1]} ${space[2]}`,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      background: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
                      opacity: isActive ? 1 : 0.5,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: STATUS_STAMP[status].text,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: fontSize.xs, color: color.textPrimary }}>
                      {STATUS_CHIP_LABEL[status]}
                    </span>
                    <span style={{ fontSize: fontSize['2xs'], color: color.textSecondary }}>
                      {statusCounts[status]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={sectionLabelStyle}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[1], alignItems: 'center' }}>
              {sortedTags.length === 0 && (
                <span style={{ opacity: 0.5, fontSize: fontSize['2xs'] }}>No tags</span>
              )}
              {visibleTags.map((tag) => {
                const isActive = activeTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => togglePlanTag(tag)}
                    aria-pressed={isActive}
                    style={{
                      fontSize: fontSize['2xs'],
                      padding: `2px ${space[2]}`,
                      borderRadius: 6,
                      border: '0.5px solid rgba(0,0,0,0.12)',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(0,0,0,0.08)' : 'transparent',
                      opacity: isActive ? 1 : 0.55,
                    }}
                  >
                    {tag} {tagCounts[tag] ?? 0}
                  </button>
                );
              })}
              {hiddenCount > 0 && (
                <button type="button" onClick={() => setTagsExpanded(true)} style={linkStyle}>
                  +{hiddenCount} more
                </button>
              )}
              {tagsExpanded && sortedTags.length > VISIBLE_TAG_COUNT && (
                <button type="button" onClick={() => setTagsExpanded(false)} style={linkStyle}>
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
