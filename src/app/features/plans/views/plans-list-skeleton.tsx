import { RowSkeleton } from '@dendelion/folk-ui';
import { PLAN_ROW_COLUMNS } from './plan-rows';

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

/** Mirrors PlanRows' layout so nothing jumps when /api/plans resolves (status
 * derives from a `gh` PR lookup, so a cold read can take a moment). */
export const PlansListSkeleton = () => (
  <div className="flex flex-col gap-1" aria-hidden="true">
    <RowSkeleton surface="card" columns={PLAN_ROW_COLUMNS} className="h-8" />
    {ROW_KEYS.map((key) => (
      <RowSkeleton key={key} surface="card" columns={PLAN_ROW_COLUMNS} />
    ))}
  </div>
);
