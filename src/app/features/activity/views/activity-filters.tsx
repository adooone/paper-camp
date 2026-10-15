import { CheckboxFilterRow, SidebarAction, SidebarSection } from '@/app/components';
import type { LogRowOutcome, LogRowType } from '@/types/index';
import { SidebarLabel } from '@dendelion/folk-ui';
import { LOG_TYPE_LABELS } from '../constants';
import { toggleInAll, useActivityFilters, useLogRows } from '../hooks';

const OUTCOME_ORDER: LogRowOutcome[] = [
  'running',
  'done',
  'error',
  'open',
  'superseded',
  'interrupted',
];

const countBy = <K extends string>(values: K[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
};

interface FilterSectionProps<T extends string> {
  label: string;
  options: T[];
  selected: T[];
  counts: Record<string, number>;
  labelFor: (value: T) => string;
  onChange: (next: T[]) => void;
}

const FilterSection = <T extends string>({
  label,
  options,
  selected,
  counts,
  labelFor,
  onChange,
}: FilterSectionProps<T>) => (
  <SidebarSection>
    <div className="flex items-end justify-between gap-2">
      <SidebarLabel>{label}</SidebarLabel>
      {selected.length > 0 && (
        <span className="pb-0.5">
          <SidebarAction onClick={() => onChange([])}>Clear</SidebarAction>
        </span>
      )}
    </div>
    <div className="flex flex-col">
      {options.map((option) => {
        const checked = selected.length === 0 || selected.includes(option);
        return (
          <CheckboxFilterRow
            key={option}
            label={labelFor(option)}
            checked={checked}
            count={counts[option] ?? 0}
            ariaLabel={`${checked ? 'Hide' : 'Show'} ${labelFor(option)}`}
            onChange={() => onChange(toggleInAll(selected, options, option))}
          />
        );
      })}
    </div>
  </SidebarSection>
);

/** Outcome and type filters for Activity, in the sidebar like the Ideas status
 *  filter — the toolbar keeps one row however many kinds of run there are. */
export const ActivityFilters = () => {
  const { allRows, availableTypes } = useLogRows();
  const { filters, setFilters } = useActivityFilters();

  const outcomeCounts = countBy(allRows.map((row) => row.outcome));
  const typeCounts = countBy(allRows.map((row) => row.type));
  const outcomes = OUTCOME_ORDER.filter(
    (outcome) => (outcomeCounts[outcome] ?? 0) > 0 || filters.outcomes.includes(outcome),
  );

  if (allRows.length === 0) return null;

  return (
    <>
      <FilterSection<LogRowOutcome>
        label="Outcome"
        options={outcomes}
        selected={filters.outcomes}
        counts={outcomeCounts}
        labelFor={(outcome) => outcome.charAt(0).toUpperCase() + outcome.slice(1)}
        onChange={(next) => setFilters({ outcomes: next })}
      />
      <FilterSection<LogRowType>
        label="Type"
        options={availableTypes}
        selected={filters.types}
        counts={typeCounts}
        labelFor={(type) => LOG_TYPE_LABELS[type]}
        onChange={(next) => setFilters({ types: next })}
      />
    </>
  );
};
