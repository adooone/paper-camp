import { type ScopeRow, useScope } from '@/app/features/scope';
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
import type { ThreadMessage } from '@/types/index';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { LOG_PAGE_SIZE } from '../constants';
import { markReadIdFor, mergeScopedActivityEntries } from '../helpers';
import { useChatThread } from './use-chat-thread';
import { useLogRows } from './use-run-rows';
import { useScopeActivity } from './use-scope-activity';

function matchChat(messages: ThreadMessage[], filters: LogFilters): ThreadMessage[] {
  const cutoff = rangeCutoffMs(filters.range);
  const q = filters.q.trim().toLowerCase();
  return messages.filter((message) => {
    if (cutoff > 0 && (!message.date || Date.parse(message.date) < cutoff)) return false;
    return !q || message.text.toLowerCase().includes(q);
  });
}

export const useActivityPage = () => {
  const { loading, allRows, availableTypes } = useLogRows();
  const chat = useChatThread();
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

  const [targetProjectKey, setTargetProjectKey] = useState<string | null>(null);
  const targetProject =
    (targetProjectKey && checkedScopeRows.find((r) => r.key === targetProjectKey)) ||
    currentScopeRow;

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

  const matchedChat = useMemo(() => matchChat(chat.thread, filters), [chat.thread, filters]);

  const ownEntries = useMemo(
    () =>
      buildActivityEntries(
        activityKind === 'chat' ? [] : matchedRows,
        activityKind === 'runs' ? [] : matchedChat,
        filters.sort,
      ),
    [activityKind, matchedRows, matchedChat, filters.sort],
  );

  const foreignEntries = useMemo(
    () =>
      scopeActivity.data.map(({ project, rows, chat: foreignChat }) => ({
        project,
        entries: buildActivityEntries(
          activityKind === 'chat' ? [] : filterLogRows(rows, filters),
          activityKind === 'runs' ? [] : matchChat(foreignChat, filters),
          filters.sort,
        ),
      })),
    [scopeActivity.data, activityKind, filters],
  );

  const scopedEntries = useMemo(
    () =>
      mergeScopedActivityEntries(
        ownEntries,
        foreignEntries,
        filters.sort,
        multiProject ? currentScopeRow : undefined,
      ),
    [ownEntries, foreignEntries, filters.sort, multiProject, currentScopeRow],
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
    (activityKind === 'chat' ? 0 : allRows.length) +
    (activityKind === 'runs' ? 0 : chat.thread.length) +
    scopeActivity.data.reduce(
      (sum, { rows, chat: foreignChat }) =>
        sum +
        (activityKind === 'chat' ? 0 : rows.length) +
        (activityKind === 'runs' ? 0 : foreignChat.length),
      0,
    );

  const markAllRead = async () => {
    for (const id of unreadIds) await markRead(id);
    for (const { project, id } of foreignUnread) await scopeActivity.markRead(project, id);
  };

  const handleSend = async () => {
    const sentToForeign = Boolean(targetProject && !targetProject.isCurrent);
    const ok = await chat.handleSend(targetProject);
    if (ok && sentToForeign && targetProject) await scopeActivity.refetch(targetProject.runtimeUrl);
  };

  const handleAnswer = async (text: string, project?: ScopeRow) => {
    const ok = await chat.handleAnswer(text, project);
    if (ok && project && !project.isCurrent) await scopeActivity.refetch(project.runtimeUrl);
    return ok;
  };

  return {
    loading,
    entries: visibleEntries,
    hasMore: scopedEntries.length > visibleEntries.length,
    loadMore: () => setVisibleCount((n) => n + LOG_PAGE_SIZE),
    hasAnyRows:
      allRows.length > 0 ||
      chat.thread.length > 0 ||
      scopeActivity.data.some(
        ({ rows, chat: foreignChat }) => rows.length > 0 || foreignChat.length > 0,
      ),
    hasMatches: scopedEntries.length > 0,
    totalCount: totalEntryCount,
    matchedCount: scopedEntries.length,
    runningRows,
    unreadCount: unreadIds.length + foreignUnread.length,
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
    handleSend,
    handleAnswer,
    multiProject,
    projectOptions: checkedScopeRows,
    targetProject,
    setTargetProjectKey,
    onOpenCrossProject: scope.openRow,
  };
};
