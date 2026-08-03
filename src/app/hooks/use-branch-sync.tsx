import {
  type SyncResult,
  fixGitDivergence,
  pullFromOrigin,
  pushChanges,
  resolveConflict,
  syncToMain,
} from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { Button, useToast } from '@dendelion/paper-ui';
import { useCallback } from 'react';

type GitAction = 'push' | 'sync' | 'pull' | 'fix-divergence';

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
  const { toast, dismiss } = useToast();
  // Sync/pull can bring upstream commits, so refresh plans/ideas too — git-status alone would leave them stale.
  const refreshAfterUpstream = () => Promise.all([loadGitStatus(), loadPlans(), loadIdeas()]);

  const [pushing, runPush] = useTrackedAction('push', 'Push failed');
  const [syncing, runSync] = useTrackedAction('sync', 'Sync failed');
  const [pulling, runPull] = useTrackedAction('pull', 'Pull failed');
  const [fixingDivergence, runFixDivergence] = useTrackedAction('fix-divergence', 'Fix failed');

  // Handles a deterministic sync/fix-divergence failure: a plain reconcile failure was
  // already auto-handed to a recovery agent (result.recovering), while a genuine content
  // conflict (result.conflictPrompt) waits for an explicit click before the agent touches
  // it, so a bad auto-merge never lands unseen. Returns true once handled — false means
  // the caller should still throw result.message.
  const handleDeterministicFailure = useCallback(
    (label: string, result: Extract<SyncResult, { ok: false }>) => {
      if (result.recovering) {
        toast({
          title: `${label} needs help`,
          description: 'Handed off to a recovery agent — see Stack for progress',
          variant: 'warning',
        });
        return true;
      }
      if ('conflictPrompt' in result) {
        const { conflictPrompt, message } = result;
        const toastId = toast({
          title: `${label} hit a conflict`,
          description: (
            <div className="flex flex-col items-start gap-2">
              <span>{oneLineErrorSummary(message)}</span>
              <Button
                size="small"
                onClick={async () => {
                  dismiss(toastId);
                  const launch = await resolveConflict(conflictPrompt);
                  toast({
                    title: launch.ok ? 'Resolving conflict' : 'Could not start the agent',
                    description: launch.ok
                      ? 'Handed off to the agent — see Stack for progress'
                      : launch.error,
                    variant: launch.ok ? 'warning' : 'error',
                  });
                }}
              >
                Ask the agent to resolve
              </Button>
            </div>
          ),
          variant: 'error',
          duration: 0,
        });
        return true;
      }
      return false;
    },
    [toast, dismiss],
  );

  const handlePush = () =>
    runPush(async () => {
      await pushChanges();
      await loadGitStatus();
    });
  const handleSync = () =>
    runSync(async () => {
      const result = await syncToMain();
      if (!result.ok) {
        if (handleDeterministicFailure('Sync', result)) {
          await loadGitStatus();
          return;
        }
        throw new Error(result.message);
      }
      await refreshAfterUpstream();
    });
  const handlePull = () =>
    runPull(async () => {
      await pullFromOrigin();
      await refreshAfterUpstream();
    });
  const handleFixDivergence = () =>
    runFixDivergence(async () => {
      const result = await fixGitDivergence();
      if (!result.ok) {
        if (handleDeterministicFailure('Fix', result)) {
          await loadGitStatus();
          return;
        }
        throw new Error(result.message);
      }
      await refreshAfterUpstream();
    });

  return {
    pushing,
    syncing,
    pulling,
    fixingDivergence,
    gitActionBusy,
    handlePush,
    handleSync,
    handlePull,
    handleFixDivergence,
  };
}
