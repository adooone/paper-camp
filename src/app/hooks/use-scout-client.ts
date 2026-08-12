import { type OpenQuestionGroup, collectOpenQuestions } from '@/app/features/plans/helpers';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { fetchPlans } from '@/app/services/content';
import { useCallback, useEffect, useState } from 'react';

export interface ScoutClientState {
  openQuestions: OpenQuestionGroup[];
  openQuestionCount: number;
  refresh: () => Promise<void>;
}

// Store-free sibling of the desk's open-questions inbox (IDEA-130 phase 3),
// so the toolbar's Scout segment can badge/triage without pulling in useAppStore.
export function useScoutClient(): ScoutClientState {
  const [openQuestions, setOpenQuestions] = useState<OpenQuestionGroup[]>([]);

  const load = useCallback(async () => {
    try {
      const { entries } = await fetchPlans();
      setOpenQuestions(collectOpenQuestions(entries));
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [load]);

  const openQuestionCount = openQuestions.reduce((sum, group) => sum + group.questions.length, 0);

  return { openQuestions, openQuestionCount, refresh: load };
}
