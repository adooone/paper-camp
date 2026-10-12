import { RowSkeleton, Skeleton } from '@dendelion/paper-ui';
import { PLAN_ROW_COLUMNS } from './plan-rows';

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

const HEADER_COLUMNS = { ...PLAN_ROW_COLUMNS, id: '112px' };

/** Mirrors PlanRows' layout, including its 36px marker gutter sitting outside the
 * row, so nothing jumps when /api/plans resolves (status derives from a `gh` PR
 * lookup, so a cold read can take a moment). */
export const PlansListSkeleton = () => (
  <div className="flex flex-col gap-1" aria-hidden="true">
    <RowSkeleton surface="card" columns={HEADER_COLUMNS} className="h-8" />
    {ROW_KEYS.map((key) => (
      <div key={key} className="flex items-center">
        <span className="flex-[0_0_36px] flex items-center justify-center">
          <Skeleton variant="text" width={16} />
        </span>
        <div className="flex-1 min-w-0">
          <RowSkeleton surface="card" columns={PLAN_ROW_COLUMNS} />
        </div>
      </div>
    ))}
  </div>
);
