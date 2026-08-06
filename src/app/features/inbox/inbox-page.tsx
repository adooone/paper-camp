import { PageTitle } from '@/app/components/page-title';
import { PlanIdStamp } from '@/app/features/plans/components';
import { fetchParkedQuestions } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import type { ParkedQuestion } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const formatAge = (ageDays: number): string => {
  if (!Number.isFinite(ageDays)) return 'age unknown';
  if (ageDays <= 0) return 'today';
  return ageDays === 1 ? '1 day ago' : `${ageDays} days ago`;
};

export const InboxPage = () => {
  const [questions, setQuestions] = useState<ParkedQuestion[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();

  useEffect(() => {
    fetchParkedQuestions()
      .then(setQuestions)
      .catch(() => setLoadFailed(true));
  }, []);

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
          {questions.map((q, i) => (
            <div
              key={`${q.entityId}-${i}`}
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
              <span className="opacity-50 text-xs whitespace-nowrap">{formatAge(q.ageDays)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
