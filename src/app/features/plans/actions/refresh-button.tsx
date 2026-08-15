import { RefreshIcon } from '@/app/components/icons';
import { useAppStore } from '@/app/stores/app-store';
import { IconButton, useToast } from '@dendelion/paper-ui';
import { formatFetchedAt } from '../helpers/helpers';

interface RefreshButtonProps {
  label?: string;
  refreshingLabel?: string;
  surface?: 'paper' | 'chalkboard';
}

/** Only re-reads what's already there — distinct from `WorklistActionsMenu`'s
 * "Reconcile all", which launches a reconcile agent that rewrites entities. */
export const RefreshButton = ({
  label = 'Refresh data',
  refreshingLabel = 'Refreshing…',
  surface,
}: RefreshButtonProps = {}) => {
  const refreshAll = useAppStore((s) => s.refreshAll);
  const refreshing = useAppStore((s) => s.refreshing);
  const prFetchedAt = useAppStore((s) => s.status?.prFetchedAt ?? null);
  const { toast } = useToast();

  const handleClick = async () => {
    if (refreshing) return;
    const result = await refreshAll();
    if (result.ok) {
      toast({
        title: 'Up to date',
        description: 'Plans, ideas, checks and PR review state re-read.',
        variant: 'success',
      });
    } else {
      toast({
        title: "Couldn't refresh",
        description: result.error ?? 'The read failed — is the dev server running?',
        variant: 'error',
      });
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      {prFetchedAt != null && (
        <span
          className={`text-xs whitespace-nowrap ${surface === 'chalkboard' ? 'text-desk-text-muted' : 'opacity-[0.45]'}`}
        >
          {formatFetchedAt(prFetchedAt)}
        </span>
      )}
      <IconButton
        icon={
          <span className="inline-flex">
            <RefreshIcon size={16} />
          </span>
        }
        label={refreshing ? refreshingLabel : label}
        size="small"
        variant="ghost"
        surface={surface}
        disabled={refreshing}
        onClick={handleClick}
      />
    </span>
  );
};
