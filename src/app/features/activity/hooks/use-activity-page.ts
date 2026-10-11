import { useScope } from '@/app/features/scope';
import { useAppStore } from '@/app/stores/app-store';
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
import { markReadIdFor, mergeScopedActivityEntries } from '../helpers';
import { useLogRows } from './use-run-rows';
import { useScopeActivity } from './use-scope-activity';

export const useActivityPage = () => {
  const { loading, allRows, availableTypes } = useLogRows();
  const navigate = useNavigate();
  const markRead = useAppStore((s) => s.markRead);
  const search = useSearch({ strict: false }) as LogSearchParams;
  const [visibleCount, setVisibleCount] = useState(LOG_PAGE_SIZE);

  const scope = useScope(null);
  const allScopeRows = useMemo(() => scope.groups.flatMap((g) => g.rows), [scope.groups]);
  const currentScopeRow = allScopeRows.find((r) => r.isCurrent);
  const checkedScopeRows = allScopeRows.filter((r) => r.checked);
  const multiProject = checkedScopeRows.length > 1;
  const otherScopeProjects = multiProject ? checkedScopeRows.filter((r) => !r.isCurrent) : [];
  const scopeActivity = useScopeActivity(otherScopeProjects);

  const filters = useMemo(() => parseLogFilters(search), [search]);

  const setFilters = (patch: Partial<LogFilters>) => {
    navigate({
      to: '/activity',
      search: serializeLogFilters({ ...filters, ...patch }),
      replace: true,
    });
  };

  const matchedRows = useMemo(() => filterLogRows(allRows, filters), [allRows, filters]);

  const foreignRows = useMemo(
    () =>
      scopeActivity.data.map(({ project, rows }) => ({
        project,
        rows: filterLogRows(rows, filters),
      })),
    [scopeActivity.data, filters],
  );

  const scopedEntries = useMemo(
    () =>
      mergeScopedActivityEntries(
        matchedRows,
        foreignRows,
        filters.sort,
        multiProject ? currentScopeRow : undefined,
      ),
    [matchedRows, foreignRows, filters.sort, multiProject, currentScopeRow],
  );

  const stats = useMemo(() => computeLogStats(matchedRows), [matchedRows]);

  const visibleEntries = scopedEntries.slice(0, visibleCount);

  const runningRows = useMemo(() => allRows.filter((row) => row.outcome === 'running'), [allRows]);
  const unreadIds = useMemo(
    () => allRows.map(markReadIdFor).filter((id): id is string => id !== undefined),
    [allRows],
  );
  const foreignUnread = useMemo(
    () =>
      scopeActivity.data.flatMap(({ project, rows }) =>
        rows
          .map(markReadIdFor)
          .filter((id): id is string => id !== undefined)
          .map((id) => ({ project, id })),
      ),
    [scopeActivity.data],
  );
  const hasActiveFilters = Object.keys(serializeLogFilters(filters)).length > 0;

  const totalEntryCount =
    allRows.length + scopeActivity.data.reduce((sum, { rows }) => sum + rows.length, 0);

  const markAllRead = async () => {
    for (const id of unreadIds) await markRead(id);
    for (const { project, id } of foreignUnread) await scopeActivity.markRead(project, id);
  };

  return {
    loading,
    entries: visibleEntries,
    hasMore: scopedEntries.length > visibleEntries.length,
    loadMore: () => setVisibleCount((n) => n + LOG_PAGE_SIZE),
    hasAnyRows: allRows.length > 0 || scopeActivity.data.some(({ rows }) => rows.length > 0),
    hasMatches: scopedEntries.length > 0,
    totalCount: totalEntryCount,
    matchedCount: scopedEntries.length,
    runningRows,
    unreadCount: unreadIds.length + foreignUnread.length,
    markAllRead,
    hasActiveFilters,
    clearFilters: () => navigate({ to: '/activity', search: {}, replace: true }),
    stats,
    filters,
    setFilters,
    availableTypes,
    onOpenCrossProject: scope.openRow,
  };
};
