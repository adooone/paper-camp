import { FeedbackThread, PlanIdStamp } from '@/app/features/plans/components';
import { useSendFeedbackMessage } from '@/app/features/plans/hooks';
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from '@/app/utils/local-draft-store';
import type { ParkedQuestion, PlanEntry } from '@/types/index';
import { Button, Spinner, Textarea, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { formatAge } from './helpers';

interface QuestionRowProps {
  question: ParkedQuestion;
  plan: PlanEntry;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  reload: () => Promise<void>;
}

export const QuestionRow = ({
  question,
  plan,
  expanded,
  onToggle,
  onOpen,
  reload,
}: QuestionRowProps) => {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const { sending, send, undo, undoing, undoEdit } = useSendFeedbackMessage(plan, {
    reload,
    notify: toast,
  });

  const draftKey = `question-reply:${question.entityId}`;

  useEffect(() => {
    const draft = readLocalDraft<string>(draftKey);
    if (draft) setInput(draft);
  }, [draftKey]);

  useEffect(() => {
    if (!input) return;
    writeLocalDraft(draftKey, input);
  }, [draftKey, input]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (await send(input.trim())) {
      setInput('');
      removeLocalDraft(draftKey);
    }
  };

  return (
    <div className="border-b border-black/10 last:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${question.entityTitle}`}
          className="bg-transparent border-none p-0 cursor-pointer"
        >
          <PlanIdStamp id={question.entityId} />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex-1 min-w-0 truncate text-left bg-transparent border-none p-0 cursor-pointer"
        >
          {question.text}
        </button>
        <span className="opacity-50 text-xs whitespace-nowrap">{formatAge(question.ageDays)}</span>
      </div>
      {expanded && (
        <div className="flex flex-col gap-3 pb-4">
          <FeedbackThread
            messages={plan.thread ?? []}
            undo={undo}
            undoing={undoing}
            onUndo={undoEdit}
          />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label={`Reply to ${question.entityTitle}`}
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
      )}
    </div>
  );
};
