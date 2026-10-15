import { promoteFeedbackMessage } from '@/app/services/agent-api';
import { createIdea } from '@/app/services/content';
import { refreshPlans } from '@/app/services/query-client';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PlanEntry } from '@/types/index';
import { useToast } from '@dendelion/folk-ui';
import { useState } from 'react';

// Distillation: turns one ephemeral `chat` thread message into a durable
// decision/log entry, or into a whole new idea entity — see IDEA-130 phase 4.
export const usePromoteThreadMessage = (plan: PlanEntry) => {
  const { toast } = useToast();
  const [promotingIndex, setPromotingIndex] = useState<number | null>(null);

  const promoteToDurable = async (index: number, target: 'decision' | 'log') => {
    if (!plan.id || promotingIndex !== null) return;
    setPromotingIndex(index);
    try {
      await promoteFeedbackMessage(plan.id, index, target);
      await refreshPlans();
    } catch (err) {
      toast({
        title: 'Promote failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setPromotingIndex(null);
    }
  };

  const promoteToIdea = async (
    index: number,
    idea: { title: string; content?: string; kind?: 'idea' | 'note' | 'board' },
  ): Promise<boolean> => {
    if (!plan.id || promotingIndex !== null) return false;
    setPromotingIndex(index);
    try {
      const newId = await createIdea(idea);
      // Best-effort breadcrumb — the idea itself is already created either way.
      await promoteFeedbackMessage(
        plan.id,
        index,
        'log',
        `Captured as ${newId}: ${idea.title}`,
      ).catch(() => {});
      await refreshPlans();
      return true;
    } catch (err) {
      toast({
        title: 'Promote failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
      return false;
    } finally {
      setPromotingIndex(null);
    }
  };

  return { promotingIndex, promoteToDurable, promoteToIdea };
};
