import { usePrReviewStatus } from '@/app/hooks/use-pr-review-status';
import { completeIdea } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PlanEntry } from '@/types/index';
import { ListItem, useToast } from '@dendelion/paper-ui';
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

  const isDisabled = disabled || completing || !plan.id || !gate.ready;

  return (
    <div className="flex flex-col gap-0.5">
      <ListItem
        size="small"
        // Raw glyph: needs an arbitrary green tint paper-ui's CheckIcon can't take.
        icon={<span className="text-watercolor-green-dark">✓</span>}
        onClick={handleClick}
        disabled={isDisabled}
        className={`pc-row text-xs ${isDisabled ? 'opacity-50' : ''}`}
      >
        {completing ? 'Completing…' : 'Complete idea'}
      </ListItem>
      {!gate.ready && gate.missing.length > 0 && (
        <div className="text-2xs text-ink-300 px-2">Waiting on {gate.missing.join(', ')}</div>
      )}
    </div>
  );
};
