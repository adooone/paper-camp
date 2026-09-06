import { EmptyState, RowSkeleton } from '@/app/components';
import { RestingPenIllustration } from '@/app/components/empty-state-illustrations';
import { PageTitle } from '@/app/components/page-title';
import { useLogPage } from './hooks';
import { LogFilterBar, LogList } from './views';

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
  } = useLogPage();

  return (
    <div>
      <PageTitle>Log</PageTitle>
      {loading && !hasAnyRows && <RowSkeleton />}
      {!loading && !hasAnyRows && (
        <EmptyState illustration={<RestingPenIllustration />} message="No runs recorded yet." />
      )}
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
