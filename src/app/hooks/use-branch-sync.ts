import { pullFromOrigin, pushChanges, syncToMain } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { useToast } from '@dendelion/paper-ui';
import { useCallback } from 'react';

type GitAction = 'push' | 'sync' | 'pull';

// Shared by push/sync/pull: run an action against the store-wide lock so no two
// can run at once across any useBranchSync() mount, and toast a one-line
// summary if it throws — the only thing the three differ on.
function useTrackedAction(kind: GitAction, failTitle: string) {
  const { toast } = useToast();
  const activeGitAction = useAppStore((s) => s.activeGitAction);
  const setActiveGitAction = useAppStore((s) => s.setActiveGitAction);
  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (useAppStore.getState().activeGitAction) return;
      setActiveGitAction(kind);
      try {
        await action();
      } catch (err) {
        toast({
          title: failTitle,
          description: oneLineErrorSummary((err as Error).message),
          variant: 'error',
        });
      } finally {
        setActiveGitAction(null);
      }
    },
    [toast, failTitle, kind, setActiveGitAction],
  );
  return [activeGitAction === kind, run] as const;
}

export function useBranchSync() {
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const gitActionBusy = useAppStore((s) => s.activeGitAction !== null);
  const { toast } = useToast();
  // Sync/pull can bring upstream commits, so refresh plans/ideas too — git-status alone would leave them stale.
  const refreshAfterUpstream = () => Promise.all([loadGitStatus(), loadPlans(), loadIdeas()]);

  const [pushing, runPush] = useTrackedAction('push', 'Push failed');
  const [syncing, runSync] = useTrackedAction('sync', 'Sync failed');
  const [pulling, runPull] = useTrackedAction('pull', 'Pull failed');

  const handlePush = () =>
    runPush(async () => {
      await pushChanges();
      await loadGitStatus();
    });
  const handleSync = () =>
    runSync(async () => {
      const result = await syncToMain();
      // A deterministic failure that handed off to a recovery agent isn't a sync
      // failure yet — the agent still runs and reports through the Stack panel.
      if (!result.ok && result.recovering) {
        toast({
          title: 'Sync needs help',
          description: 'Handed off to a recovery agent — see Stack for progress',
          variant: 'warning',
        });
        await loadGitStatus();
        return;
      }
      if (!result.ok) throw new Error(result.message);
      await refreshAfterUpstream();
    });
  const handlePull = () =>
    runPull(async () => {
      await pullFromOrigin();
      await refreshAfterUpstream();
    });

  return { pushing, syncing, pulling, gitActionBusy, handlePush, handleSync, handlePull };
}
