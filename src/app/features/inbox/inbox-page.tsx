import { PageTitle } from '@/app/components/page-title';
import { PlanIdStamp } from '@/app/features/plans/components';
import { useAppStore } from '@/app/stores/app-store';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { formatAge } from './helpers';
import { QuestionRow } from './question-row';

export const InboxPage = () => {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const questions = useAppStore((s) => s.parkedQuestions);
  const loadFailed = useAppStore((s) => s.parkedQuestionsError !== null);
  const plans = useAppStore((s) => s.plans);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadParkedQuestions = useAppStore((s) => s.loadParkedQuestions);
  const navigate = useNavigate();

  useEffect(() => {
    loadParkedQuestions();
  }, [loadParkedQuestions]);

  const reload = async () => {
    await Promise.all([loadPlans(), loadParkedQuestions()]);
  };

  const openEntity = (title: string) => {
    if (plans?.entries.some((p) => p.title === title)) {
      navigate({ to: '/plans/$planId', params: { planId: encodeURIComponent(title) } });
    } else {
      navigate({ to: '/ideas/$ideaId', params: { ideaId: encodeURIComponent(title) } });
    }
  };

  return (
    <div>
      <PageTitle>Inbox</PageTitle>
      <p className="opacity-50 mb-6">
        Every open agent question, oldest first — parked decisions waiting on a human.
      </p>
      {loadFailed && <p className="opacity-50">Couldn't load parked questions.</p>}
      {!loadFailed && !questions && <p className="opacity-50">Loading…</p>}
      {questions && questions.length === 0 && (
        <p className="opacity-50">Nothing parked — every agent question has an answer.</p>
      )}
      {questions && questions.length > 0 && (
        <div className="flex flex-col">
          {questions.map((q, i) => {
            const key = `${q.entityId}-${i}`;
            const plan = plans?.entries.find((p) => p.id === q.entityId);
            if (!plan) {
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 py-2.5 border-b border-black/10 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => openEntity(q.entityTitle)}
                    aria-label={`Open ${q.entityTitle}`}
                    className="bg-transparent border-none p-0 cursor-pointer"
                  >
                    <PlanIdStamp id={q.entityId} />
                  </button>
                  <span className="flex-1 min-w-0 truncate">{q.text}</span>
                  <span className="opacity-50 text-xs whitespace-nowrap">
                    {formatAge(q.ageDays)}
                  </span>
                </div>
              );
            }
            return (
              <QuestionRow
                key={key}
                question={q}
                plan={plan}
                expanded={expandedKey === key}
                onToggle={() => setExpandedKey((cur) => (cur === key ? null : key))}
                onOpen={() => openEntity(q.entityTitle)}
                reload={reload}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
