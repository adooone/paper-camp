import { DoodleIllustration, RowSkeleton } from '@/app/components';
import { EmptyState, PageTitle } from '@dendelion/paper-ui';
import { useActivityPage } from './hooks';
import { ActivityStatsLine, ActivityStream, ActivityTitleActions, ActivityToolbar } from './views';

export const ActivityPage = () => {
  const {
    loading,
    entries,
    hasMore,
    loadMore,
    hasAnyRows,
    hasMatches,
    filters,
    setFilters,
    totalCount,
    matchedCount,
    runningRows,
    unreadCount,
    markAllRead,
    hasActiveFilters,
    clearFilters,
    stats,
    onOpenCrossProject,
  } = useActivityPage();

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <PageTitle className="shrink-0">Activity</PageTitle>
        {hasAnyRows && (
          <span className="font-handwritten text-base opacity-60">
            {matchedCount === totalCount
              ? `${totalCount} ${totalCount === 1 ? 'entry' : 'entries'}`
              : `${matchedCount} of ${totalCount} entries`}
          </span>
        )}
      </div>

      <ActivityToolbar
        filters={filters}
        onFiltersChange={setFilters}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        actions={
          hasAnyRows && (
            <ActivityTitleActions
              runningRows={runningRows}
              unreadCount={unreadCount}
              unreadFilterOn={filters.unread}
              onToggleUnread={() => setFilters({ unread: !filters.unread })}
              onMarkAllRead={markAllRead}
            />
          )
        }
      />
      <ActivityStatsLine stats={stats} />

      {loading && !hasAnyRows && <RowSkeleton />}
      {!loading && !hasAnyRows && (
        <EmptyState
          illustration={<DoodleIllustration name="resting-pen" />}
          message="Nothing recorded yet."
        />
      )}
      {hasAnyRows &&
        (hasMatches ? (
          <ActivityStream
            sort={filters.sort}
            onSort={(sort) => setFilters({ sort })}
            entries={entries}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onOpenCrossProject={onOpenCrossProject}
          />
        ) : (
          <p className="opacity-50">No entries match these filters.</p>
        ))}
    </div>
  );
};
