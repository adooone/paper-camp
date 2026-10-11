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
    availableTypes,
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
      <div className="mb-2 flex flex-nowrap items-center gap-3">
        <PageTitle className="shrink-0">Activity</PageTitle>
        <div className="flex-1" />
        {hasAnyRows && (
          <ActivityTitleActions
            runningRows={runningRows}
            unreadCount={unreadCount}
            unreadFilterOn={filters.unread}
            onToggleUnread={() => setFilters({ unread: !filters.unread })}
            onMarkAllRead={markAllRead}
            matchedCount={matchedCount}
            totalCount={totalCount}
          />
        )}
      </div>

      <ActivityToolbar
        filters={filters}
        availableTypes={availableTypes}
        onFiltersChange={setFilters}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
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
