import { SidebarSection } from '@/app/components';
import { useOpenEntity } from '@/app/hooks';
import { fetchGitBranches } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import type { GitBranch } from '@/types/index';
import { SidebarItem, SidebarLabel } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const trackLabel = (branch: GitBranch): string | undefined => {
  if (branch.gone) return 'merged';
  if (!branch.upstream) return undefined;
  const parts = [branch.ahead > 0 && `↑${branch.ahead}`, branch.behind > 0 && `↓${branch.behind}`];
  return parts.filter(Boolean).join(' ') || undefined;
};

/** Local branches beside the history — only on a clean tree, when the page shows history
 *  rather than diffs. A branch named for an idea opens that idea. */
export const GitBranchList = () => {
  const [branches, setBranches] = useState<GitBranch[] | null>(null);
  const openEntity = useOpenEntity();
  const showsHistory = useAppStore((s) => s.diffFiles?.length === 0);
  // A checkout, push or pull moves these; the store's branch and counts change with them.
  const refreshKey = useAppStore((s) => `${s.gitBranch}:${s.gitAhead}:${s.gitBehind}`);

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

  return (
    <SidebarSection>
      <SidebarLabel>Branches</SidebarLabel>
      <div className="flex flex-col">
        {branches.map((branch) => (
          <SidebarItem
            key={branch.name}
            active={branch.current}
            ariaLabel={branch.ideaId ? `Open ${branch.ideaId}` : branch.name}
            onClick={
              branch.ideaId ? () => openEntity(branch.ideaId, branch.ideaId ?? '') : undefined
            }
            count={trackLabel(branch)}
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
