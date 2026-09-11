import { SidebarCommand } from '@/app/components/sidebar';
import { usePrReviewStatus } from '@/app/hooks/use-pr-review-status';
import { completeIdea } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PlanEntry } from '@/types/index';
import { CheckIcon, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { completionGate } from '../helpers';

interface CompleteIdeaButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const CompleteIdeaButton = ({ plan, disabled }: CompleteIdeaButtonProps) => {
  const refreshAll = useAppStore((s) => s.refreshAll);
  const [completing, setCompleting] = useState(false);
  const { toast } = useToast();
  const reviewStatus = usePrReviewStatus(plan.id);
  const gate = completionGate(plan, reviewStatus?.ciGreen);

  const handleClick = async () => {
    if (!plan.id) return;
    setCompleting(true);
    try {
      const result = await completeIdea(plan.id);
      if (result.needsAttention) {
        toast({
          title: 'Merged — main needs manual sync',
          description: oneLineErrorSummary(result.needsAttention),
          variant: 'error',
        });
      } else {
        toast({
          title: 'Idea complete',
          description: `${plan.id} merged — main is up to date`,
          variant: 'success',
        });
      }
      await refreshAll();
    } catch (err) {
      toast({
        title: 'Complete failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <SidebarCommand
      icon={<CheckIcon size={16} />}
      onClick={handleClick}
      disabled={disabled || !plan.id || !gate.ready}
      busy={completing ? 'Completing…' : undefined}
      note={
        !gate.ready && gate.missing.length > 0 ? `Waiting on ${gate.missing.join(', ')}` : undefined
      }
    >
      Complete idea
    </SidebarCommand>
  );
};
