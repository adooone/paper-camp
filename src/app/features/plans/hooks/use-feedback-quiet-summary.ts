import { summarizeFeedbackSession } from '@/app/services/agent-api';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { useEffect } from 'react';

const QUIET_MS = 3 * 60_000;

// A chat session "goes quiet" when its last message sits unanswered for a while —
// the timer resets on every new message (any thread change moves `last` off `chat`
// or replaces it) and fires at most once per quiet stretch, since the log entry it
// appends is no longer `chat` itself. `enabled` scopes this to whichever mount is
// actually showing the thread (see IDEA-130 phase 4).
export const useFeedbackQuietSummary = (plan: PlanEntry, enabled: boolean): void => {
  const loadPlans = useAppStore((s) => s.loadPlans);
  const thread = plan.thread ?? [];
  const last = thread[thread.length - 1];
  const planId = plan.id;

  useEffect(() => {
    if (!enabled || !planId || !last || last.kind !== 'chat') return;
    const timer = setTimeout(() => {
      summarizeFeedbackSession(planId)
        .then((result) => {
          if (!result.skipped) return loadPlans();
        })
        .catch(() => {});
    }, QUIET_MS);
    return () => clearTimeout(timer);
  }, [enabled, planId, last, loadPlans]);
};
