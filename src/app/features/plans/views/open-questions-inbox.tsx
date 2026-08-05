import { FeedbackThread, PlanIdStamp } from '@/app/features/plans/components';
import { type OpenQuestionGroup, collectOpenQuestions } from '@/app/features/plans/helpers';
import { useSendFeedbackMessage } from '@/app/features/plans/hooks';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Accordion, Button, Card, Spinner, Stamp, Textarea, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

const QuestionGroupCard = ({ plan, questions }: OpenQuestionGroup) => {
  const navigate = useNavigate();
  const loadPlans = useAppStore((s) => s.loadPlans);
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const { sending, send, undo, undoing, undoEdit } = useSendFeedbackMessage(plan, {
    reload: loadPlans,
    notify: toast,
  });

  const handleSend = async () => {
    if (!input.trim()) return;
    if (await send(input.trim())) setInput('');
  };

  return (
    <Card size="small" accent accentColor="amber" texture="kraft">
      <button
        type="button"
        onClick={() =>
          navigate({ to: '/plans/$planId', params: { planId: encodeURIComponent(plan.title) } })
        }
        className="flex items-center gap-2 mb-3 bg-transparent border-none p-0 cursor-pointer text-left [font:inherit] underline"
      >
        <PlanIdStamp id={plan.id} />
        {plan.title}
      </button>
      <div className="flex flex-col gap-3 mb-4">
        <FeedbackThread messages={questions} undo={undo} undoing={undoing} onUndo={undoEdit} />
      </div>
      <div className="flex flex-col gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label={`Reply to ${plan.title}`}
          placeholder="Reply to resolve and resume…"
          rows={2}
          disabled={sending}
        />
        <div className="flex justify-end items-center gap-3">
          <span className={sending ? 'visible' : 'invisible'}>
            <Spinner size="small" label="Agent replying…" />
          </span>
          <Button size="small" onClick={handleSend} disabled={sending || !input.trim()}>
            Reply
          </Button>
        </div>
      </div>
    </Card>
  );
};

interface OpenQuestionsInboxProps {
  plans: PlanEntry[];
}

// Project-wide triage: every open parked question across every idea, oldest
// first, folded into the same chat-thread rendering as the per-idea Feedback
// panel — replying here resolves the question and resumes the parked run
// exactly like replying from inside the idea (see useSendFeedbackMessage).
export const OpenQuestionsInbox = ({ plans }: OpenQuestionsInboxProps) => {
  const [expanded, setExpanded] = useState(false);
  const groups = collectOpenQuestions(plans);
  const total = groups.reduce((sum, group) => sum + group.questions.length, 0);

  if (total === 0) return null;

  return (
    <div className="mb-6">
      <Accordion
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        title={
          <span className={`${sectionHeadingClass} inline-flex items-center gap-2`}>
            Open questions
            <Stamp size="small" variant="warning">
              {total}
            </Stamp>
          </span>
        }
      >
        <div className="flex flex-col gap-4 pt-2">
          {groups.map((group) => (
            <QuestionGroupCard
              key={group.plan.id ?? group.plan.title}
              plan={group.plan}
              questions={group.questions}
            />
          ))}
        </div>
      </Accordion>
    </div>
  );
};
