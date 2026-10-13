import {
  type LogFilters,
  type LogSearchParams,
  parseLogFilters,
  serializeLogFilters,
} from '@/core/run-filters';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';

/** Activity's filters live in the URL, so the page and its sidebar read and write
 *  the same state without a store of their own. */
export const useActivityFilters = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as LogSearchParams;
  const filters = useMemo(() => parseLogFilters(search), [search]);

  const setFilters = (patch: Partial<LogFilters>) => {
    navigate({
      to: '/activity',
      search: serializeLogFilters({ ...filters, ...patch }),
      replace: true,
    });
  };

  const clearFilters = () => navigate({ to: '/activity', search: {}, replace: true });
  const hasActiveFilters = Object.keys(serializeLogFilters(filters)).length > 0;

  return { filters, setFilters, clearFilters, hasActiveFilters };
};

/** An empty list means "all", so ticking a box off the full set starts an explicit
 *  list, and ticking the last one back on returns to "all". */
export function toggleInAll<T>(selected: T[], all: T[], value: T): T[] {
  const current = selected.length === 0 ? all : selected;
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return next.length === all.length ? [] : next;
}
