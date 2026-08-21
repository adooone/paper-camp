import { GitSyncActions } from '@/app/components';
import { useAppStore } from '@/app/stores/app-store';

export const DeliverEmptyState = () => {
  const gitAhead = useAppStore((s) => s.gitAhead);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="m-0 text-center text-xs opacity-50">
        {gitAhead > 0
          ? `All changes committed — ${gitAhead} commit${gitAhead === 1 ? '' : 's'} ready to push.`
          : 'No changed files.'}
      </p>
      <GitSyncActions />
    </div>
  );
};
