import { EmptyState } from '@/app/components';
import { RestingPenIllustration } from '@/app/components/empty-state-illustrations';
import { PageTitle } from '@/app/components/page-title';
import { useLogPage } from './hooks';
import { LogFilterBar, LogList, LogStatsStrip } from './views';

export const LogPage = () => {
  const {
    loading,
    rows,
    hasMore,
    loadMore,
    hasAnyRows,
    hasMatches,
    stats,
    entry,
    containerRef,
    filters,
    setFilters,
    availableTypes,
    actions,
  } = useLogPage();

  return (
    <div ref={containerRef}>
      <PageTitle>Log</PageTitle>
      {loading && !hasAnyRows && <p className="opacity-50">Loading…</p>}
      {!loading && !hasAnyRows && (
        <EmptyState illustration={<RestingPenIllustration />} message="No runs recorded yet." />
      )}
      {hasAnyRows && (
        <>
          <LogFilterBar filters={filters} availableTypes={availableTypes} onChange={setFilters} />
          <LogStatsStrip stats={stats} />
          {hasMatches ? (
            <LogList
              rows={rows}
              hasMore={hasMore}
              onLoadMore={loadMore}
              actions={actions}
              highlightedEntry={entry}
            />
          ) : (
            <p className="opacity-50">No rows match these filters.</p>
          )}
        </>
      )}
    </div>
  );
};
