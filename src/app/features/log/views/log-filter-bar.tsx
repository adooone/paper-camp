import type { LogDateRange, LogFilters, LogSort } from '@/core/log-filters';
import { AGENT_IDS, AGENT_LABELS, type LogRowOutcome, type LogRowType } from '@/types/index';
import { Input, Select, Stamp } from '@dendelion/paper-ui';
import { LOG_TYPE_LABELS } from '../constants';

const OUTCOME_OPTIONS: LogRowOutcome[] = ['done', 'error', 'superseded', 'open'];

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

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: string;
}

const FilterChip = ({ active, onClick, children }: FilterChipProps) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className="border-none bg-transparent p-0 cursor-pointer"
  >
    <Stamp size="small" variant={active ? 'info' : 'neutral'}>
      {children}
    </Stamp>
  </button>
);

export interface LogFilterBarProps {
  filters: LogFilters;
  availableTypes: LogRowType[];
  onChange: (patch: Partial<LogFilters>) => void;
}

export const LogFilterBar = ({ filters, availableTypes, onChange }: LogFilterBarProps) => {
  const toggleOutcome = (outcome: LogRowOutcome) => {
    const active = filters.outcomes.includes(outcome);
    onChange({
      outcomes: active
        ? filters.outcomes.filter((o) => o !== outcome)
        : [...filters.outcomes, outcome],
    });
  };

  const toggleType = (type: LogRowType) => {
    const active = filters.types.includes(type);
    onChange({
      types: active ? filters.types.filter((t) => t !== type) : [...filters.types, type],
    });
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          size="small"
          placeholder="Search title, entity, or reason…"
          aria-label="Search the log"
          value={filters.q}
          onChange={(event) => onChange({ q: event.target.value })}
        />
        <Select
          size="small"
          value={filters.agent ?? ''}
          options={AGENT_OPTIONS}
          onChange={(value) =>
            onChange({ agent: value ? (value as LogFilters['agent']) : undefined })
          }
        />
        <Select
          size="small"
          value={filters.range}
          options={RANGE_OPTIONS}
          onChange={(value) => onChange({ range: value as LogDateRange })}
        />
        <Select
          size="small"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(value) => onChange({ sort: value as LogSort })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {OUTCOME_OPTIONS.map((outcome) => (
          <FilterChip
            key={outcome}
            active={filters.outcomes.includes(outcome)}
            onClick={() => toggleOutcome(outcome)}
          >
            {outcome}
          </FilterChip>
        ))}
      </div>
      {availableTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {availableTypes.map((type) => (
            <FilterChip
              key={type}
              active={filters.types.includes(type)}
              onClick={() => toggleType(type)}
            >
              {LOG_TYPE_LABELS[type]}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );
};
