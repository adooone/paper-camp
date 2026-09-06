import { EmptyState } from '@/app/components';
import { RestingPenIllustration } from '@/app/components/empty-state-illustrations';
import { PageTitle } from '@/app/components/page-title';
import { useLogPage } from './hooks';
import { LogList } from './views';

export const LogPage = () => {
  const { loading, rows, hasMore, loadMore } = useLogPage();

  return (
    <div>
      <PageTitle>Log</PageTitle>
      {loading && rows.length === 0 && <p className="opacity-50">Loading…</p>}
      {!loading && rows.length === 0 && (
        <EmptyState illustration={<RestingPenIllustration />} message="No runs recorded yet." />
      )}
      {rows.length > 0 && <LogList rows={rows} hasMore={hasMore} onLoadMore={loadMore} />}
    </div>
  );
};
