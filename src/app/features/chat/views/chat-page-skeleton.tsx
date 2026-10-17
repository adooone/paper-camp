import { Card, PageTitle, RowSkeleton, Skeleton } from '@dendelion/folk-ui';
import { surface } from '@dendelion/folk-ui/tokens';

const ROW_KEYS = ['a', 'b', 'c'];

export const ChatPageSkeleton = () => (
  <div className="h-full flex flex-col min-h-0">
    <output aria-live="polite" className="sr-only">
      Loading…
    </output>
    <div className="mb-2 flex flex-nowrap items-center gap-3 shrink-0" aria-hidden="true">
      <PageTitle className="shrink-0">Scout</PageTitle>
    </div>

    <div className="flex-1 min-h-0 flex flex-col gap-1" aria-hidden="true">
      {ROW_KEYS.map((key) => (
        <RowSkeleton key={key} surface="card" slots={['title']} />
      ))}
    </div>

    <div className="shrink-0" aria-hidden="true">
      <Card size="small" accent accentColor="slate" texture={surface.card} className="mb-4 w-full">
        <Skeleton variant="rect" width="100%" height="4.5em" />
      </Card>
    </div>
  </div>
);
