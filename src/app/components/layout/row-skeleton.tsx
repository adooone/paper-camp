import { Card, Skeleton } from '@dendelion/paper-ui';

// Shared by every runtime area without its own list skeleton (Docs, Roadmap, Settings,
// Tasks) — reuses `.plan-row-card`, the row styling already shared across those areas.
const ROWS = [
  { key: 'a', width: '76%' },
  { key: 'b', width: '52%' },
  { key: 'c', width: '64%' },
  { key: 'd', width: '44%' },
];

export const RowSkeleton = () => (
  <div className="flex flex-col gap-1">
    <output aria-live="polite" className="sr-only">
      Loading…
    </output>
    <div className="flex flex-col gap-1" aria-hidden="true">
      {ROWS.map((r) => (
        <Card key={r.key} size="small" className="plan-row-card">
          <Skeleton variant="text" width={r.width} />
        </Card>
      ))}
    </div>
  </div>
);
