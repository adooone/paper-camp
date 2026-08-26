import { PageTitle } from '@/app/components/page-title';
import { useStatsPage } from './hooks';
import { StatsGrid } from './views';

export const StatsPage = () => {
  const { stats, loadFailed } = useStatsPage();

  return (
    <div>
      <PageTitle>Stats</PageTitle>
      <p className="opacity-50 mb-6">
        A read-only look at project health — every number here is informational, none of them gate
        anything.
      </p>
      {loadFailed && <p className="opacity-50">Couldn't load stats.</p>}
      {!loadFailed && !stats && <p className="opacity-50">Loading…</p>}
      {stats && <StatsGrid stats={stats} />}
    </div>
  );
};
