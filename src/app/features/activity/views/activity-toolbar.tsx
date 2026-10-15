import { PageToolbar, PageToolbarRow, SidebarAction } from '@/app/components';
import type { LogDateRange, LogFilters } from '@/core/run-filters';
import { AGENT_IDS, AGENT_LABELS } from '@/types/index';
import { Input, Select } from '@dendelion/folk-ui';
import type { ReactNode } from 'react';

const RANGE_OPTIONS: { value: LogDateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

const AGENT_OPTIONS = [
  { value: '', label: 'Any agent' },
  ...AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] })),
];

export interface ActivityToolbarProps {
  filters: LogFilters;
  onFiltersChange: (patch: Partial<LogFilters>) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  /** Running, unread and mark-all-read, at the row's right end. */
  actions?: ReactNode;
}

export const ActivityToolbar = ({
  filters,
  onFiltersChange,
  hasActiveFilters,
  onClearFilters,
  actions,
}: ActivityToolbarProps) => (
  <PageToolbar>
    <PageToolbarRow>
      <Input
        type="search"
        size="small"
        placeholder="Search activity…"
        aria-label="Search activity"
        value={filters.q}
        onChange={(event) => onFiltersChange({ q: event.target.value })}
        className="w-[230px] min-w-[140px] shrink"
      />
      <Select
        size="small"
        value={filters.agent ?? ''}
        options={AGENT_OPTIONS}
        width={128}
        className="shrink-0"
        onChange={(value) =>
          onFiltersChange({ agent: value ? (value as typeof filters.agent) : undefined })
        }
      />
      <Select
        size="small"
        value={filters.range}
        options={RANGE_OPTIONS}
        width={108}
        className="shrink-0"
        onChange={(value) => onFiltersChange({ range: value as LogDateRange })}
      />
      {hasActiveFilters && <SidebarAction onClick={onClearFilters}>Clear filters</SidebarAction>}
      <span className="flex-1" />
      {actions}
    </PageToolbarRow>
  </PageToolbar>
);
