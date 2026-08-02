import { Card, Skeleton } from '@dendelion/paper-ui';
import { PLAN_ROWS_GRID_CLASS } from './plan-rows';

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

// Mirrors PlanRows' layout, including its 36px marker gutter sitting outside the
// Card, so nothing jumps when /api/plans resolves (status derives from a `gh` PR
// lookup, so a cold read can take a moment).
export const PlansListSkeleton = () => (
  <div className="flex flex-col gap-1" aria-hidden="true">
    <div className="flex items-center">
      <span className="flex-[0_0_36px]" />
      <div className="flex-1 min-w-0">
        <Card size="small" texture="kraft" className="plan-row-card">
          <div className={PLAN_ROWS_GRID_CLASS}>
            <Skeleton variant="text" width={28} />
            <Skeleton variant="text" width={44} />
            <span className="max-lg:hidden">
              <Skeleton variant="text" width={56} />
            </span>
            <Skeleton variant="text" width={64} />
            <Skeleton variant="text" width={48} />
          </div>
        </Card>
      </div>
    </div>
    {ROWS.map((r) => (
      <div key={r.key} className="flex items-center">
        <span className="flex-[0_0_36px] flex items-center justify-center">
          <Skeleton variant="text" width={16} />
        </span>
        <div className="flex-1 min-w-0">
          <Card size="small" className="plan-row-card">
            <div className={PLAN_ROWS_GRID_CLASS}>
              <Skeleton variant="rect" width={44} height={18} />
              <Skeleton variant="text" width={r.title} />
              <span className="max-lg:hidden">
                <Skeleton variant="text" width={52} />
              </span>
              <Skeleton variant="rect" width={80} height={8} />
              <Skeleton variant="rect" width={64} height={20} />
            </div>
          </Card>
        </div>
      </div>
    ))}
  </div>
);
