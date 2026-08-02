import { Card, Skeleton } from '@dendelion/paper-ui';

// Stable keys + varied title widths so the placeholder rows read as a real,
// slightly-irregular list rather than identical bars.
const ROWS = [
  { key: 'a', title: '72%' },
  { key: 'b', title: '54%' },
  { key: 'c', title: '83%' },
  { key: 'd', title: '46%' },
  { key: 'e', title: '66%' },
  { key: 'f', title: '58%' },
];

// Mirrors PlanRows' layout on the shared plan rows grid template so nothing jumps
// when /api/plans resolves (status derives from a `gh` PR lookup, so a cold read can take a moment).
export const PlansListSkeleton = () => (
  <div className="flex flex-col gap-1" aria-hidden="true">
    <Card size="small" texture="kraft" className="plan-row-card">
      <div className="grid grid-cols-[76px_minmax(0,1fr)_84px_96px_112px] gap-2.5 items-center max-lg:grid-cols-[76px_minmax(0,1fr)_96px_112px] max-[480px]:grid-cols-1 max-[480px]:gap-1">
        <Skeleton variant="text" width={36} />
        <Skeleton variant="text" width={28} />
        <Skeleton variant="text" width={44} />
        <span className="max-lg:hidden">
          <Skeleton variant="text" width={56} />
        </span>
        <Skeleton variant="text" width={64} />
        <Skeleton variant="text" width={48} />
      </div>
    </Card>
    {ROWS.map((r) => (
      <Card key={r.key} size="small" className="plan-row-card">
        <div className="grid grid-cols-[76px_minmax(0,1fr)_84px_96px_112px] gap-2.5 items-center max-lg:grid-cols-[76px_minmax(0,1fr)_96px_112px] max-[480px]:grid-cols-1 max-[480px]:gap-1">
          <Skeleton variant="text" width={16} />
          <Skeleton variant="rect" width={44} height={18} />
          <Skeleton variant="text" width={r.title} />
          <span className="max-lg:hidden">
            <Skeleton variant="text" width={52} />
          </span>
          <Skeleton variant="rect" width={80} height={8} />
          <Skeleton variant="rect" width={64} height={20} />
        </div>
      </Card>
    ))}
  </div>
);
