import { SidebarSection } from '@/app/components';
import { useOpenEntity } from '@/app/hooks';
import { checkoutBranch, fetchGitBranches } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { GitBranch } from '@/types/index';
import { SidebarItem, SidebarLabel, Stamp, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const trackLabel = (branch: GitBranch): string | undefined => {
  if (branch.gone) return 'merged';
  if (!branch.upstream) return undefined;
  const parts = [branch.ahead > 0 && `↑${branch.ahead}`, branch.behind > 0 && `↓${branch.behind}`];
  return parts.filter(Boolean).join(' ') || undefined;
};

/** Local branches beside the history — only on a clean tree, when the page shows history
 *  rather than diffs. Clicking a row checks it out; its id stamp opens the idea instead. */
export const GitBranchList = () => {
  const [branches, setBranches] = useState<GitBranch[] | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const openEntity = useOpenEntity();
  const { toast } = useToast();
  const showsHistory = useAppStore((s) => s.diffFiles?.length === 0);
  // A checkout, push or pull moves these; the store's branch and counts change with them.
  const refreshKey = useAppStore((s) => `${s.gitBranch}:${s.gitAhead}:${s.gitBehind}`);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const loadDiffFiles = useAppStore((s) => s.loadDiffFiles);
  const loadGitLog = useAppStore((s) => s.loadGitLog);
  const loadPlans = useAppStore((s) => s.loadPlans);

  useEffect(() => {
    let cancelled = false;
    void refreshKey;
    fetchGitBranches()
      .then((next) => {
        if (!cancelled) setBranches(next);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!showsHistory || !branches || branches.length === 0) return null;

  const handleCheckout = async (branch: string) => {
    if (switching) return;
    setSwitching(branch);
    try {
      await checkoutBranch(branch);
      await Promise.all([loadGitStatus(), loadDiffFiles(), loadGitLog(), loadPlans()]);
      toast({ title: `Switched to ${branch}`, variant: 'success' });
    } catch (err) {
      toast({
        title: 'Checkout failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setSwitching(null);
    }
  };

  return (
    <SidebarSection>
      <SidebarLabel>Branches</SidebarLabel>
      <div className="flex flex-col">
        {branches.map((branch) => (
          <SidebarItem
            key={branch.name}
            active={branch.current}
            ariaLabel={branch.current ? branch.name : `Switch to ${branch.name}`}
            busy={switching === branch.name ? 'Switching…' : undefined}
            disabled={branch.current || (switching !== null && switching !== branch.name)}
            onClick={branch.current ? undefined : () => handleCheckout(branch.name)}
            count={trackLabel(branch)}
            action={
              branch.ideaId ? (
                <Stamp
                  size="small"
                  variant="idea"
                  ariaLabel={`Open ${branch.ideaId}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openEntity(branch.ideaId, branch.ideaId ?? '');
                  }}
                >
                  {branch.ideaId}
                </Stamp>
              ) : undefined
            }
          >
            <span className="font-mono text-xs" title={branch.name}>
              {branch.name}
            </span>
          </SidebarItem>
        ))}
      </div>
    </SidebarSection>
  );
};
