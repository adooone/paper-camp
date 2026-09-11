import { SidebarDivider, SidebarField } from '@/app/components/sidebar';
import { formatDuration } from '@/core/phase-run';
import type { LogDateRange, LogSort } from '@/core/run-filters';
import { AGENT_IDS, AGENT_LABELS } from '@/types/index';
import { Input, Select } from '@dendelion/paper-ui';
import { formatCost } from './helpers';
import { useLogPage } from './hooks';

const RANGE_OPTIONS: { value: LogDateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

const SORT_OPTIONS: { value: LogSort; label: string }[] = [
  { value: 'time', label: 'Time' },
  { value: 'duration', label: 'Duration' },
  { value: 'cost', label: 'Cost' },
];

const AGENT_OPTIONS = [
  { value: '', label: 'Any agent' },
  ...AGENT_IDS.map((id) => ({ value: id, label: AGENT_LABELS[id] })),
];

interface StatRowProps {
  label: string;
  value: string;
}

const StatRow = ({ label, value }: StatRowProps) => (
  <div className="flex min-w-0 flex-col">
    <span className="font-handwritten text-xs font-semibold opacity-[0.45] whitespace-nowrap">
      {label}
    </span>
    <span className="font-handwritten font-semibold text-base whitespace-nowrap">{value}</span>
  </div>
);

export const LogSidebar = () => {
  const { filters, setFilters, stats, hasActiveFilters, clearFilters } = useLogPage();

  return (
    <div className="flex flex-col">
      <SidebarField label="Search">
        <Input
          type="search"
          size="small"
          placeholder="Search title, entity, or reason…"
          aria-label="Search the log"
          value={filters.q}
          onChange={(event) => setFilters({ q: event.target.value })}
        />
      </SidebarField>

      <SidebarField label="Agent">
        <Select
          size="small"
          value={filters.agent ?? ''}
          options={AGENT_OPTIONS}
          onChange={(value) =>
            setFilters({ agent: value ? (value as typeof filters.agent) : undefined })
          }
        />
      </SidebarField>

      <SidebarField label="Range">
        <Select
          size="small"
          value={filters.range}
          options={RANGE_OPTIONS}
          onChange={(value) => setFilters({ range: value as LogDateRange })}
        />
      </SidebarField>

      <SidebarField label="Sort">
        <Select
          size="small"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(value) => setFilters({ sort: value as LogSort })}
        />
      </SidebarField>

      {hasActiveFilters && (
        <button
          type="button"
          data-testid="clear-log-filters"
          onClick={clearFilters}
          className="pc-row-label text-2xs opacity-70 underline text-left"
        >
          Clear filters
        </button>
      )}

      <SidebarDivider />

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <StatRow label="Runs" value={String(stats.runs)} />
        <StatRow label="Failed" value={String(stats.failed)} />
        <StatRow
          label="Success rate"
          value={stats.successRate == null ? '—' : `${Math.round(stats.successRate * 100)}%`}
        />
        <StatRow label="Total cost" value={formatCost(stats.totalCostUsd)} />
        <StatRow
          label="Median duration"
          value={stats.medianDurationMs == null ? '—' : formatDuration(stats.medianDurationMs)}
        />
      </div>
    </div>
  );
};
