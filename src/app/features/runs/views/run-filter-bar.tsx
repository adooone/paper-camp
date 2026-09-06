import type { LogFilters } from '@/core/run-filters';
import type { LogRowOutcome, LogRowType } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { LOG_TYPE_LABELS } from '../constants';

const OUTCOME_OPTIONS: LogRowOutcome[] = ['done', 'error', 'superseded', 'open'];

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
    className="shrink-0 border-none bg-transparent p-0 cursor-pointer"
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
    <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {OUTCOME_OPTIONS.map((outcome) => (
        <FilterChip
          key={outcome}
          active={filters.outcomes.includes(outcome)}
          onClick={() => toggleOutcome(outcome)}
        >
          {outcome}
        </FilterChip>
      ))}
      {availableTypes.length > 0 && (
        <span className="w-px shrink-0 self-stretch bg-ink-200" aria-hidden="true" />
      )}
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
  );
};
