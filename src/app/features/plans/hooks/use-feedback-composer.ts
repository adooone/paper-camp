import type { PromoteTarget } from '@/app/features/plans/components/feedback-thread';
import {
  feedbackDraftKeyFor,
  readLocalDraft,
  removeLocalDraft,
  writeLocalDraft,
} from '@/app/utils/local-draft-store';
import type { PlanEntry } from '@/types/index';
import { useEffect, useState } from 'react';
import { useFeedbackQuietSummary } from './use-feedback-quiet-summary';
import { usePromoteThreadMessage } from './use-promote-thread-message';

export async function runHandleAnswer(
  text: string,
  onSend: (text: string) => Promise<boolean>,
  setPending: (v: string | null) => void,
): Promise<boolean> {
  setPending(text);
  const ok = await onSend(text);
  setPending(null);
  return ok;
}

export function useFeedbackComposer(plan: PlanEntry, onSend: (text: string) => Promise<boolean>) {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [ideaPromptIndex, setIdeaPromptIndex] = useState<number | null>(null);
  const thread = plan.thread ?? [];
  const { promotingIndex, promoteToDurable, promoteToIdea } = usePromoteThreadMessage(plan);
  useFeedbackQuietSummary(plan, true);

  const draftKey = feedbackDraftKeyFor(plan);

  useEffect(() => {
    setInput(readLocalDraft<string>(draftKey) ?? '');
  }, [draftKey]);

  useEffect(() => {
    if (!input) return;
    writeLocalDraft(draftKey, input);
  }, [draftKey, input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setPending(text);
    setInput('');
    if (await onSend(text)) {
      removeLocalDraft(draftKey);
    } else {
      setInput((current) => current || text);
    }
    setPending(null);
  };

  // A picked option or a question card's own reply field answers exactly like a
  // typed message, but never touches the composer's draft — it isn't that draft.
  const handleAnswer = (text: string) => runHandleAnswer(text, onSend, setPending);

  const handlePromote = (index: number, target: PromoteTarget) => {
    if (target === 'idea') setIdeaPromptIndex(index);
    else promoteToDurable(index, target);
  };

  const handlePromoteToIdea = async (idea: {
    title: string;
    content?: string;
    kind?: 'idea' | 'note' | 'board';
  }) => {
    if (ideaPromptIndex === null) return;
    if (await promoteToIdea(ideaPromptIndex, idea)) setIdeaPromptIndex(null);
  };

  const closeIdeaPrompt = () => setIdeaPromptIndex(null);

  return {
    thread,
    input,
    setInput,
    pending,
    promotingIndex,
    ideaPromptIndex,
    handleSend,
    handleAnswer,
    handlePromote,
    handlePromoteToIdea,
    closeIdeaPrompt,
  };
}
