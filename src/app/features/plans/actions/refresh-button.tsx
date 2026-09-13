import { RefreshIcon } from '@/app/components/icons';
import { useAppStore } from '@/app/stores/app-store';
import { Button, IconButton, useToast } from '@dendelion/paper-ui';

interface RefreshButtonProps {
  label?: string;
  refreshingLabel?: string;
  surface?: 'paper' | 'chalkboard';
  /** Render the label as visible text rather than an icon-only control. */
  withText?: boolean;
}

/** Only re-reads what's already there — distinct from `WorklistActionsMenu`'s
 * "Reconcile all", which launches a reconcile agent that rewrites entities. */
/** The refresh action with its toasts, shared by the button and the status bar's overflow menu. */
export const useRefreshAll = () => {
  const refreshAll = useAppStore((s) => s.refreshAll);
  const refreshing = useAppStore((s) => s.refreshing);
  const { toast } = useToast();

  const refresh = async () => {
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

  return { refresh, refreshing };
};

export const RefreshButton = ({
  label = 'Refresh data',
  refreshingLabel = 'Refreshing…',
  surface,
  withText = false,
}: RefreshButtonProps = {}) => {
  const { refresh: handleClick, refreshing } = useRefreshAll();

  if (withText) {
    return (
      <Button
        size="small"
        variant="ghost"
        surface={surface}
        disabled={refreshing}
        onClick={handleClick}
        className="font-handwritten text-xs"
      >
        {refreshing ? refreshingLabel : label}
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
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
