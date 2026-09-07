import { EmptyState, RowSkeleton } from '@/app/components';
import { PageTitle } from '@/app/components/page-title';
import { useLogPage } from './hooks';
import { LogFilterBar, LogList, LogTitleActions } from './views';

export const LogPage = () => {
  const {
    loading,
    rows,
    hasMore,
    loadMore,
    hasAnyRows,
    hasMatches,
    filters,
    setFilters,
    availableTypes,
    totalCount,
    matchedCount,
    runningRows,
    unreadCount,
    markAllRead,
    hasActiveFilters,
    clearFilters,
  } = useLogPage();

  return (
    <div>
      <div className="mb-2 flex flex-nowrap items-center gap-3">
        <PageTitle className="mb-0 shrink-0">Log</PageTitle>
        <div className="flex-1" />
        {hasAnyRows && (
          <LogTitleActions
            runningRows={runningRows}
            unreadCount={unreadCount}
            unreadFilterOn={filters.unread}
            onToggleUnread={() => setFilters({ unread: !filters.unread })}
            onMarkAllRead={markAllRead}
            matchedCount={matchedCount}
            totalCount={totalCount}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        )}
      </div>
      {loading && !hasAnyRows && <RowSkeleton />}
      {!loading && !hasAnyRows && <EmptyState message="No runs recorded yet." />}
      {hasAnyRows && (
        <>
          <LogFilterBar filters={filters} availableTypes={availableTypes} onChange={setFilters} />
          {hasMatches ? (
            <LogList rows={rows} hasMore={hasMore} onLoadMore={loadMore} />
          ) : (
            <p className="opacity-50">No rows match these filters.</p>
          )}
        </>
      )}
    </div>
  );
};
