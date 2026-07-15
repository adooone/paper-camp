import { RefreshIcon } from '@/app/components/icons';
import { useAppStore } from '@/app/stores/app-store';
import { IconButton, useToast } from '@dendelion/paper-ui';
import { motion } from 'framer-motion';

/**
 * Manual "actualise data" for the worklist header. Distinct from `ActualiseAllButton`,
 * which launches a reconcile agent that *rewrites* entities — this only re-reads
 * what's already there (plans, ideas, suggestions, checks, git, PR/review state),
 * dropping the server's PR cache first so review signals aren't TTL-bound.
 */
export const RefreshButton = () => {
  const refreshAll = useAppStore((s) => s.refreshAll);
  const refreshing = useAppStore((s) => s.refreshing);
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
    <IconButton
      icon={
        <motion.span
          style={{ display: 'inline-flex' }}
          animate={{ rotate: refreshing ? 360 : 0 }}
          transition={
            refreshing
              ? { repeat: Number.POSITIVE_INFINITY, ease: 'linear', duration: 0.8 }
              : { duration: 0 }
          }
        >
          <RefreshIcon size={16} />
        </motion.span>
      }
      label={refreshing ? 'Refreshing…' : 'Refresh data'}
      size="small"
      variant="ghost"
      disabled={refreshing}
      onClick={handleClick}
    />
  );
};
