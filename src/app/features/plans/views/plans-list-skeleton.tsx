import { space } from '@/app/styles/tokens';
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

/**
 * Loading placeholder for the worklist — mirrors `PlanRows`' kraft header + paper
 * rows on the shared `.plan-rows-grid` template, so the layout doesn't jump when
 * the real rows arrive. Shown while `/api/plans` resolves (it derives status from
 * a `gh` PR lookup, so a cold read can take a moment).
 */
export const PlansListSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }} aria-hidden="true">
    <Card size="small" texture="kraft" className="plan-row-card">
      <div className="plan-rows-grid">
        <Skeleton variant="text" width={28} />
        <Skeleton variant="text" width={44} />
        <span className="plan-rows-cell-updated">
          <Skeleton variant="text" width={56} />
        </span>
        <Skeleton variant="text" width={64} />
        <Skeleton variant="text" width={48} />
      </div>
    </Card>
    {ROWS.map((r) => (
      <Card key={r.key} size="small" className="plan-row-card">
        <div className="plan-rows-grid">
          <Skeleton variant="rect" width={44} height={18} />
          <Skeleton variant="text" width={r.title} />
          <span className="plan-rows-cell-updated">
            <Skeleton variant="text" width={52} />
          </span>
          <Skeleton variant="rect" width={80} height={8} />
          <Skeleton variant="rect" width={64} height={20} />
        </div>
      </Card>
    ))}
  </div>
);
