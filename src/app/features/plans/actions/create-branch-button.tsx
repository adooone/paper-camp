import { createPlanBranch } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PlanEntry } from '@/types/index';
import { ListItem, Tooltip, useToast } from '@dendelion/paper-ui';
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

  const isDisabled = disabled || branching || !plan.id;

  return (
    <div className="flex flex-col gap-0.5">
      <Tooltip
        content={
          plan.id
            ? `Creates ${(plan.kind ?? 'feat').toLowerCase()}/${plan.id.toLowerCase()}-… from main, or switches to it if it already exists`
            : undefined
        }
      >
        <ListItem
          size="small"
          icon={<span className="text-ink-500">⎇</span>}
          onClick={handleClick}
          disabled={isDisabled}
          className={`pc-row text-xs ${isDisabled ? 'opacity-50' : ''}`}
        >
          {branching ? 'Switching…' : 'Create branch'}
        </ListItem>
      </Tooltip>
      <div className="text-2xs text-ink-300 px-2">
        <code>{gitBranch ?? 'unknown'}</code> — not this plan's branch
      </div>
    </div>
  );
};
