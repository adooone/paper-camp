import { type OpenQuestionGroup, collectOpenQuestions } from '@/app/features/plans/helpers';
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
    const source = new EventSource('/api/activity/stream');
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (event) => {
      let payload: { message?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 250);
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [load]);

  const openQuestionCount = openQuestions.reduce((sum, group) => sum + group.questions.length, 0);

  return { openQuestions, openQuestionCount, refresh: load };
}
