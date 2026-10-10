import { useAppStore } from '@/app/stores/app-store';
import { buildActivityEntries } from '@/core/activity-entries';
import {
  type ActivityKind,
  type LogFilters,
  type LogSearchParams,
  filterLogRows,
  parseActivityKind,
  parseLogFilters,
  rangeCutoffMs,
  serializeLogFilters,
} from '@/core/run-filters';
import { computeLogStats } from '@/core/run-stats';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { LOG_PAGE_SIZE } from '../constants';
import { markReadIdFor } from '../helpers';
import { useChatThread } from './use-chat-thread';
import { useLogRows } from './use-run-rows';

export const useActivityPage = () => {
  const { loading, allRows, availableTypes } = useLogRows();
  const chat = useChatThread();
  const navigate = useNavigate();
  const markRead = useAppStore((s) => s.markRead);
  const search = useSearch({ strict: false }) as LogSearchParams;
  const [visibleCount, setVisibleCount] = useState(LOG_PAGE_SIZE);

  const filters = useMemo(() => parseLogFilters(search), [search]);
  const activityKind = parseActivityKind(search.kind);

  const setFilters = (patch: Partial<LogFilters>) => {
    navigate({
      to: '/activity',
      search: { ...serializeLogFilters({ ...filters, ...patch }), kind: search.kind },
      replace: true,
    });
  };

  const setActivityKind = (next: ActivityKind) => {
    navigate({
      to: '/activity',
      search: { ...serializeLogFilters(filters), kind: next === 'all' ? undefined : next },
      replace: true,
    });
  };

  const matchedRows = useMemo(() => filterLogRows(allRows, filters), [allRows, filters]);

  const matchedChat = useMemo(() => {
    const cutoff = rangeCutoffMs(filters.range);
    const q = filters.q.trim().toLowerCase();
    return chat.thread.filter((message) => {
      if (cutoff > 0 && (!message.date || Date.parse(message.date) < cutoff)) return false;
      return !q || message.text.toLowerCase().includes(q);
    });
  }, [chat.thread, filters.range, filters.q]);

  const entries = useMemo(
    () =>
      buildActivityEntries(
        activityKind === 'chat' ? [] : matchedRows,
        activityKind === 'runs' ? [] : matchedChat,
        filters.sort,
      ),
    [activityKind, matchedRows, matchedChat, filters.sort],
  );

  const stats = useMemo(() => computeLogStats(matchedRows), [matchedRows]);

  const visibleEntries = entries.slice(0, visibleCount);

  const runningRows = useMemo(() => allRows.filter((row) => row.outcome === 'running'), [allRows]);
  const unreadIds = useMemo(
    () => allRows.map(markReadIdFor).filter((id): id is string => id !== undefined),
    [allRows],
  );
  const hasActiveFilters = Object.keys(serializeLogFilters(filters)).length > 0;

  const markAllRead = async () => {
    for (const id of unreadIds) await markRead(id);
  };

  return {
    loading,
    entries: visibleEntries,
    hasMore: entries.length > visibleEntries.length,
    loadMore: () => setVisibleCount((n) => n + LOG_PAGE_SIZE),
    hasAnyRows: allRows.length > 0 || chat.thread.length > 0,
    hasMatches: entries.length > 0,
    totalCount: allRows.length,
    matchedCount: matchedRows.length,
    runningRows,
    unreadCount: unreadIds.length,
    markAllRead,
    hasActiveFilters,
    clearFilters: () => navigate({ to: '/activity', search: { kind: search.kind }, replace: true }),
    stats,
    filters,
    setFilters,
    availableTypes,
    activityKind,
    setActivityKind,
    chat,
  };
};
