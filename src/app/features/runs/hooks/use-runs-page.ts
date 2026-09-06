import {
  type LogFilters,
  type LogSearchParams,
  filterLogRows,
  parseLogFilters,
  serializeLogFilters,
} from '@/core/run-filters';
import { computeLogStats } from '@/core/run-stats';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { LOG_PAGE_SIZE } from '../constants';
import { useLogRows } from './use-run-rows';

export const useLogPage = () => {
  const { loading, allRows, availableTypes } = useLogRows();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as LogSearchParams;
  const [visibleCount, setVisibleCount] = useState(LOG_PAGE_SIZE);

  const filters = useMemo(() => parseLogFilters(search), [search]);

  const setFilters = (patch: Partial<LogFilters>) => {
    navigate({ to: '/log', search: serializeLogFilters({ ...filters, ...patch }), replace: true });
  };

  const matchedRows = useMemo(() => filterLogRows(allRows, filters), [allRows, filters]);

  const stats = useMemo(() => computeLogStats(matchedRows), [matchedRows]);

  const visibleRows = matchedRows.slice(0, visibleCount);

  return {
    loading,
    rows: visibleRows,
    hasMore: matchedRows.length > visibleRows.length,
    loadMore: () => setVisibleCount((n) => n + LOG_PAGE_SIZE),
    hasAnyRows: allRows.length > 0,
    hasMatches: matchedRows.length > 0,
    stats,
    filters,
    setFilters,
    availableTypes,
  };
};
