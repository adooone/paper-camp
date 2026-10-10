import { PageToolbar } from '@/app/components';
import type { ActivityKind, LogDateRange, LogFilters, LogSort } from '@/core/run-filters';
import { AGENT_IDS, AGENT_LABELS, type LogRowOutcome, type LogRowType } from '@/types/index';
import { Button, Input, Select, Stamp, type StampVariant } from '@dendelion/paper-ui';
import { LOG_OUTCOME_VARIANT, LOG_TYPE_LABELS } from '../constants';

const OUTCOME_OPTIONS: LogRowOutcome[] = ['done', 'error', 'superseded', 'open', 'interrupted'];

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

const KIND_OPTIONS: { value: ActivityKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'runs', label: 'Runs' },
  { value: 'chat', label: 'Chat' },
];

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: string;
  variant?: StampVariant;
}

const FilterChip = ({ active, onClick, children, variant }: FilterChipProps) => (
  <Stamp
    size="small"
    variant={variant ?? (active ? 'info' : 'neutral')}
    onClick={onClick}
    pressed={active}
    className={active ? '' : 'opacity-60'}
  >
    {children}
  </Stamp>
);

export interface ActivityToolbarProps {
  filters: LogFilters;
  availableTypes: LogRowType[];
  onFiltersChange: (patch: Partial<LogFilters>) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  activityKind: ActivityKind;
  onActivityKindChange: (kind: ActivityKind) => void;
}

export const ActivityToolbar = ({
  filters,
  availableTypes,
  onFiltersChange,
  hasActiveFilters,
  onClearFilters,
  activityKind,
  onActivityKindChange,
}: ActivityToolbarProps) => {
  const toggleOutcome = (outcome: LogRowOutcome) => {
    const active = filters.outcomes.includes(outcome);
    onFiltersChange({
      outcomes: active
        ? filters.outcomes.filter((o) => o !== outcome)
        : [...filters.outcomes, outcome],
    });
  };

  const toggleType = (type: LogRowType) => {
    const active = filters.types.includes(type);
    onFiltersChange({
      types: active ? filters.types.filter((t) => t !== type) : [...filters.types, type],
    });
  };

  return (
    <PageToolbar>
      <Input
        type="search"
        size="small"
        placeholder="Search title, entity, reason, or message…"
        aria-label="Search activity"
        value={filters.q}
        onChange={(event) => onFiltersChange({ q: event.target.value })}
        className="min-w-[200px] flex-[1_1_200px]"
      />

      {KIND_OPTIONS.map((opt) => (
        <FilterChip
          key={opt.value}
          active={activityKind === opt.value}
          onClick={() => onActivityKindChange(opt.value)}
        >
          {opt.label}
        </FilterChip>
      ))}

      {OUTCOME_OPTIONS.map((outcome) => (
        <FilterChip
          key={outcome}
          active={filters.outcomes.includes(outcome)}
          onClick={() => toggleOutcome(outcome)}
          variant={LOG_OUTCOME_VARIANT[outcome]}
        >
          {outcome}
        </FilterChip>
      ))}
      {availableTypes.map((type) => (
        <FilterChip
          key={type}
          active={filters.types.includes(type)}
          onClick={() => toggleType(type)}
        >
          {LOG_TYPE_LABELS[type]}
        </FilterChip>
      ))}

      <Select
        size="small"
        label="Agent"
        value={filters.agent ?? ''}
        options={AGENT_OPTIONS}
        width={140}
        onChange={(value) =>
          onFiltersChange({ agent: value ? (value as typeof filters.agent) : undefined })
        }
      />
      <Select
        size="small"
        label="Range"
        value={filters.range}
        options={RANGE_OPTIONS}
        width={120}
        onChange={(value) => onFiltersChange({ range: value as LogDateRange })}
      />
      <Select
        size="small"
        label="Sort"
        value={filters.sort}
        options={SORT_OPTIONS}
        width={120}
        onChange={(value) => onFiltersChange({ sort: value as LogSort })}
      />

      {hasActiveFilters && (
        <Button
          variant="link"
          data-testid="clear-activity-filters"
          onClick={onClearFilters}
          className="text-2xs opacity-70"
        >
          Clear filters
        </Button>
      )}
    </PageToolbar>
  );
};
