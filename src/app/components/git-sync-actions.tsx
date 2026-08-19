import { useBranchSync } from '@/app/hooks/use-branch-sync';
import { useAppStore } from '@/app/stores/app-store';
import { Button, Tooltip } from '@dendelion/paper-ui';
import { MergeIcon, PullIcon, PushIcon } from './icons';

// Always renders all three, disabling whichever doesn't apply — the one Sync/Push/Pull row.
export const GitSyncActions = () => {
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const { pushing, syncing, pulling, gitActionBusy, handlePush, handleSync, handlePull } =
    useBranchSync();

  return (
    <div className="flex items-center gap-2">
      <Tooltip content={gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : undefined}>
        <Button
          size="small"
          className="whitespace-nowrap"
          variant="secondary"
          icon={<MergeIcon size={14} />}
          disabled={gitActionBusy || gitBranchHygiene === 'clean-on-main'}
          onClick={handleSync}
        >
          {syncing ? 'Syncing…' : 'Sync to main'}
        </Button>
      </Tooltip>
      <Button
        size="small"
        className="whitespace-nowrap"
        icon={<PushIcon size={14} />}
        disabled={gitActionBusy || gitAhead === 0}
        onClick={handlePush}
      >
        {pushing ? 'Pushing…' : gitAhead > 0 ? `Push (${gitAhead})` : 'Push'}
      </Button>
      <Button
        size="small"
        className="whitespace-nowrap"
        variant="secondary"
        icon={<PullIcon size={14} />}
        disabled={gitActionBusy}
        onClick={handlePull}
      >
        {pulling ? 'Pulling…' : 'Pull'}
      </Button>
    </div>
  );
};
