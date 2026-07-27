import { splitReview } from '@/app/services/agent-api';
import { createIdea } from '@/app/services/content';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PhaseItem, PlanEntry, ReviewSplitOutcome, ReviewSplitResult } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useRef, useState } from 'react';
import { usePlanStatusPatch } from './use-plan-status-patch';

// Shared by the Split review trigger and the in-thread reply so both act on the same
// launch/approve/discard state instead of the button owning a modal it hands off to.
export const useSplitReview = (plan: PlanEntry) => {
  const { toast } = useToast();
  const { patch } = usePlanStatusPatch();
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<ReviewSplitResult | null>(null);
  const [outcome, setOutcome] = useState<ReviewSplitOutcome | null>(null);
  // Indexes into result.items already minted as ideas — survives a failed approve() so a
  // retry only creates what's still missing instead of re-minting already-created ideas.
  const createdFollowUpsRef = useRef<Set<number>>(new Set());

  const launch = async () => {
    const points = plan.review ?? [];
    if (!plan.id || points.length === 0) return;
    setLaunching(true);
    setOutcome(null);
    createdFollowUpsRef.current = new Set();
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

  // Mints follow-up ideas before touching the plan, tracking which ones already landed so a
  // retry after a partial failure only creates what's missing and review clears only once
  // every item has actually succeeded.
  const approve = async () => {
    if (!result) return;
    try {
      const followUpEntries = result.items.flatMap((item, index) =>
        item.kind === 'idea' && item.followUp ? [{ index, followUp: item.followUp }] : [],
      );
      const pending = followUpEntries.filter(
        ({ index }) => !createdFollowUpsRef.current.has(index),
      );
      const outcomes = await Promise.allSettled(
        pending.map(({ index, followUp }) =>
          createIdea({ title: followUp.title, content: followUp.body }).then(() => index),
        ),
      );
      for (const outcome of outcomes) {
        if (outcome.status === 'fulfilled') createdFollowUpsRef.current.add(outcome.value);
      }
      if (outcomes.some((outcome) => outcome.status === 'rejected')) {
        throw new Error('Failed to create one or more follow-up ideas');
      }

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
      setOutcome({
        phasesAdded: newPhases.length,
        ideaTitles: followUpEntries.map(({ followUp }) => followUp.title),
      });
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
