import { space } from '@/app/styles/tokens';
import type { PlanStatus } from '@/types/index';
import { Card, Input, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';

interface PlanFilterCardProps {
  statusCounts: Record<PlanStatus, number>;
  activeStatuses: PlanStatus[];
  onToggleStatus: (status: PlanStatus) => void;
  tagCounts: Record<string, number>;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

/** Above this many tags, the rest collapse behind a "+N more" toggle. */
const VISIBLE_TAG_COUNT = 6;

/** Chip order follows the selector's default sort precedence, not PLAN_STATUSES' declaration order. */
const STATUS_CHIP_ORDER: PlanStatus[] = [
  'in-progress',
  'review',
  'planned',
  'idea',
  'done',
  'dropped',
];

/** "Backlog" here, not STATUS_LABEL's "Idea" — matches this list's own terminology (add-to-backlog-button.tsx) for idea-status plans, distinct from the Ideas page. */
const STATUS_CHIP_LABEL: Record<PlanStatus, string> = {
  ...STATUS_LABEL,
  idea: 'Backlog',
};

/**
 * Sticky kraft Card pinned below the app header (position: sticky within the
 * page's scroll container, so it reads as pinned under the fixed app header
 * above it). Status chips double as filters and live counts; done/dropped
 * default off per FEAT-41's first-paint guard, so a plain click brings them in.
 */
export const PlanFilterCard = ({
  statusCounts,
  activeStatuses,
  onToggleStatus,
  tagCounts,
  activeTags,
  onToggleTag,
  search,
  onSearchChange,
}: PlanFilterCardProps) => {
  const active = new Set(activeStatuses);
  const activeTagSet = new Set(activeTags);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // An active tag stays visible even if the other filter dimensions currently
  // drive its live count to zero, so toggling it off is never a dead end.
  const allTags = new Set([...Object.keys(tagCounts), ...activeTags]);
  const sortedTags = [...allTags].sort((a, b) => {
    const byCount = (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0);
    return byCount !== 0 ? byCount : a.localeCompare(b);
  });
  const visibleTags = tagsExpanded ? sortedTags : sortedTags.slice(0, VISIBLE_TAG_COUNT);
  const hiddenCount = sortedTags.length - visibleTags.length;

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10, marginBottom: space[4] }}>
      <Card size="small" texture="kraft" className="plan-row-card">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: space[2],
            alignItems: 'center',
            marginBottom: space[3],
          }}
        >
          {STATUS_CHIP_ORDER.map((status) => {
            const isActive = active.has(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => onToggleStatus(status)}
                aria-pressed={isActive}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.4,
                }}
              >
                <Stamp
                  size="small"
                  fillColor={STATUS_STAMP[status].fill}
                  textColor={STATUS_STAMP[status].text}
                >
                  {STATUS_CHIP_LABEL[status]} {statusCounts[status]}
                </Stamp>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[2], alignItems: 'center' }}>
          {sortedTags.length === 0 && (
            <span style={{ opacity: 0.6, fontSize: 'var(--font-size-xs, 0.75rem)' }}>No tags</span>
          )}
          {visibleTags.map((tag) => {
            const isActive = activeTagSet.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                aria-pressed={isActive}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.4,
                }}
              >
                <Stamp size="small" variant="neutral">
                  {tag} {tagCounts[tag] ?? 0}
                </Stamp>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setTagsExpanded(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                opacity: 0.7,
                textDecoration: 'underline',
              }}
            >
              +{hiddenCount} more
            </button>
          )}
          {tagsExpanded && sortedTags.length > VISIBLE_TAG_COUNT && (
            <button
              type="button"
              onClick={() => setTagsExpanded(false)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                opacity: 0.7,
                textDecoration: 'underline',
              }}
            >
              Show less
            </button>
          )}
        </div>
        <div style={{ marginTop: space[3] }}>
          <Input
            type="search"
            size="small"
            placeholder="Search plans…"
            aria-label="Search plans"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </Card>
    </div>
  );
};
