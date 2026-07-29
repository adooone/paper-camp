import { pullFromOrigin, pushChanges, syncToMain } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { useToast } from '@dendelion/paper-ui';
import { useCallback, useState } from 'react';

// Shared by push/sync/pull: run an action, flag it busy meanwhile, and
// toast a one-line summary if it throws — the only thing the three differ on.
function useTrackedAction(failTitle: string) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const run = useCallback(
    async (action: () => Promise<void>) => {
      setRunning(true);
      try {
        await action();
      } catch (err) {
        toast({
          title: failTitle,
          description: oneLineErrorSummary((err as Error).message),
          variant: 'error',
        });
      } finally {
        setRunning(false);
      }
    },
    [toast, failTitle],
  );
  return [running, run] as const;
}

export function useBranchSync() {
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const { toast } = useToast();
  // Sync/pull can bring upstream commits, so refresh plans/ideas too — git-status alone would leave them stale.
  const refreshAfterUpstream = () => Promise.all([loadGitStatus(), loadPlans(), loadIdeas()]);

  const [pushing, runPush] = useTrackedAction('Push failed');
  const [syncing, runSync] = useTrackedAction('Sync failed');
  const [pulling, runPull] = useTrackedAction('Pull failed');

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

  return { pushing, syncing, pulling, handlePush, handleSync, handlePull };
}
