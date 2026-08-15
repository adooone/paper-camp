import { useAppStore } from '@/app/stores/app-store';
import { Stamp, Tooltip } from '@dendelion/paper-ui';

const formatStashAge = (days: number) =>
  days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;

export const GitStashSurface = () => {
  const stashes = useAppStore((s) => s.gitStashes);
  if (stashes.length === 0) return null;

  const variant = stashes.some((s) => s.own) ? 'warning' : 'neutral';

  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-1">
          {stashes.map((s) => (
            <div key={s.index}>
              {s.branch}: {s.message} · {formatStashAge(s.ageDays)}
            </div>
          ))}
        </div>
      }
    >
      <Stamp size="small" variant={variant}>
        {stashes.length} stash{stashes.length === 1 ? '' : 'es'}
      </Stamp>
    </Tooltip>
  );
};
