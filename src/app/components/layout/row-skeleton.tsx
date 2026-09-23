import { RowSkeleton as PaperRowSkeleton } from '@dendelion/paper-ui';

const ROW_KEYS = ['a', 'b', 'c', 'd'];

export interface RowSkeletonProps {
  boxless?: boolean;
}

export const RowSkeleton = ({ boxless = false }: RowSkeletonProps) => (
  <div className="flex flex-col gap-1">
    <output aria-live="polite" className="sr-only">
      Loading…
    </output>
    <div className="flex flex-col gap-1" aria-hidden="true">
      {ROW_KEYS.map((key) => (
        <PaperRowSkeleton key={key} surface={boxless ? 'none' : 'card'} slots={['title']} />
      ))}
    </div>
  </div>
);
