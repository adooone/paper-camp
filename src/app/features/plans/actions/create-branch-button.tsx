import { GitBranchIcon } from '@/app/components/icons';
import { SidebarCommand } from '@/app/components/sidebar';
import { createPlanBranch } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PlanEntry } from '@/types/index';
import { Tooltip, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';

interface CreateBranchButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const CreateBranchButton = ({ plan, disabled }: CreateBranchButtonProps) => {
  const gitBranch = useAppStore((s) => s.gitBranch);
  const loadGitStatus = useAppStore((s) => s.loadGitStatus);
  const [branching, setBranching] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    if (!plan.id) return;
    setBranching(true);
    try {
      const { branch, warning } = await createPlanBranch(plan.id);
      toast({ title: 'Branch ready', description: `Now on ${branch}`, variant: 'success' });
      if (warning) toast({ title: 'Stale fork', description: warning, variant: 'warning' });
      await loadGitStatus();
    } catch (err) {
      toast({
        title: 'Branch failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setBranching(false);
    }
  };

  return (
    <Tooltip
      content={
        plan.id
          ? `Creates ${(plan.kind ?? 'feat').toLowerCase()}/${plan.id.toLowerCase()}-… from main, or switches to it if it already exists`
          : undefined
      }
    >
      <SidebarCommand
        icon={<GitBranchIcon size={16} />}
        onClick={handleClick}
        disabled={disabled || !plan.id}
        busy={branching ? 'Switching…' : undefined}
        note={
          <>
            <code>{gitBranch ?? 'unknown'}</code> — not this plan's branch
          </>
        }
      >
        Create branch
      </SidebarCommand>
    </Tooltip>
  );
};
