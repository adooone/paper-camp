import { Card, Skeleton } from '@dendelion/paper-ui';

// `boxless` matches Settings, whose rows lost their Card in IDEA-267: a skeleton
// promises the shape that replaces it, never a box that never arrives.
const ROWS = [
  { key: 'a', width: '76%' },
  { key: 'b', width: '52%' },
  { key: 'c', width: '64%' },
  { key: 'd', width: '44%' },
];

export interface RowSkeletonProps {
  boxless?: boolean;
}

export const RowSkeleton = ({ boxless = false }: RowSkeletonProps) => (
  <div className="flex flex-col gap-1">
    <output aria-live="polite" className="sr-only">
      Loading…
    </output>
    <div className={`flex flex-col ${boxless ? '' : 'gap-1'}`} aria-hidden="true">
      {ROWS.map((r) =>
        boxless ? (
          <div key={r.key} className="pc-setting-row">
            <Skeleton variant="text" width={r.width} />
          </div>
        ) : (
          <Card key={r.key} size="small" className="plan-row-card">
            <Skeleton variant="text" width={r.width} />
          </Card>
        ),
      )}
    </div>
  </div>
);
