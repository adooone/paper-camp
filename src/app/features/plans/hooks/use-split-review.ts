import { splitReview } from '@/app/services/agent-api';
import { createIdea } from '@/app/services/content';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PhaseItem, PlanEntry, ReviewSplitOutcome, ReviewSplitResult } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { usePlanStatusPatch } from './use-plan-status-patch';

// Shared by the Split review trigger and the in-thread reply so both act on the same
// launch/approve/discard state instead of the button owning a modal it hands off to.
export const useSplitReview = (plan: PlanEntry) => {
  const { toast } = useToast();
  const { patch } = usePlanStatusPatch();
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<ReviewSplitResult | null>(null);
  const [outcome, setOutcome] = useState<ReviewSplitOutcome | null>(null);

  const launch = async () => {
    const points = plan.review ?? [];
    if (!plan.id || points.length === 0) return;
    setLaunching(true);
    setOutcome(null);
    try {
      setResult(await splitReview(plan.id));
    } catch (err) {
      toast({
        title: 'Could not split the review',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setLaunching(false);
    }
  };

  // Mints follow-up ideas before touching the plan: if idea creation fails partway,
  // the review points are left untouched so the whole approval can just be retried.
  const approve = async () => {
    if (!result) return;
    try {
      const followUps = result.items.flatMap((item) =>
        item.kind === 'idea' && item.followUp ? [item.followUp] : [],
      );
      await Promise.all(followUps.map((f) => createIdea({ title: f.title, content: f.body })));

      const newPhases: PhaseItem[] = result.items
        .flatMap((item) => (item.kind === 'rework' ? (item.phases ?? []) : []))
        .map((phase) => ({
          done: false,
          text: phase.text,
          description: phase.description,
          source: 'review',
        }));
      const ok = await patch(plan.title, {
        review: [],
        ...(newPhases.length > 0 && { phases: [...plan.phases, ...newPhases] }),
      });
      if (!ok) return;
      setResult(null);
      setOutcome({ phasesAdded: newPhases.length, ideaTitles: followUps.map((f) => f.title) });
    } catch (err) {
      toast({
        title: 'Could not apply the split',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  const discard = async () => setResult(null);

  return { launching, result, outcome, launch, approve, discard };
};
