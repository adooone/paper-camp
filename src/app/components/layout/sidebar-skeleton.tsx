import { Skeleton } from '@dendelion/paper-ui';

const LINES = [
  { key: 'a', width: '62%' },
  { key: 'b', width: '48%' },
  { key: 'c', width: '70%' },
  { key: 'd', width: '40%' },
];

// Same slots the real sidebars fill — a 64px search row, then 32px rows — so the
// card keeps its height when the content arrives.
export const SidebarSkeleton = () => (
  <div className="flex flex-col" aria-hidden="true">
    <div className="flex h-[64px] items-center">
      <Skeleton variant="rect" width="100%" height={28} />
    </div>
    {LINES.map((line) => (
      <div key={line.key} className="flex h-[32px] items-center">
        <Skeleton variant="text" width={line.width} />
      </div>
    ))}
  </div>
);
