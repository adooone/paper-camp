import { postFeedbackMessage, undoFeedbackEdit } from '@/app/services/agent-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { PlanEntry } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useState } from 'react';

// Posting a feedback message runs a one-shot agent before the reply lands in the
// thread, so this can't reuse usePlanStatusPatch's plain PATCH-and-reload shape.
export const useSendFeedbackMessage = (plan: PlanEntry) => {
  const loadPlans = useAppStore((s) => s.loadPlans);
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [undoing, setUndoing] = useState(false);
  // Only the reply this hook instance just received carries an Undo — reloading
  // the page loses it, which is fine for a one-tap "just sent" correction.
  const [undo, setUndo] = useState<{ commitSha: string } | null>(null);

  const send = async (text: string): Promise<boolean> => {
    if (!plan.id) return false;
    setSending(true);
    setUndo(null);
    try {
      const { error, undo: appliedUndo } = await postFeedbackMessage(plan.id, text);
      await loadPlans();
      if (appliedUndo) setUndo(appliedUndo);
      if (error) {
        toast({
          title: 'Agent did not reply',
          description: oneLineErrorSummary(error),
          variant: 'error',
        });
      }
      return true;
    } catch (err) {
      toast({
        title: 'Message failed to send',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
      return false;
    } finally {
      setSending(false);
    }
  };

  const undoEdit = async () => {
    if (!plan.id || !undo) return;
    setUndoing(true);
    try {
      const { error } = await undoFeedbackEdit(plan.id, undo.commitSha);
      if (error) {
        toast({ title: 'Undo failed', description: oneLineErrorSummary(error), variant: 'error' });
        return;
      }
      setUndo(null);
      await loadPlans();
    } catch (err) {
      toast({
        title: 'Undo failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setUndoing(false);
    }
  };

  return { sending, send, undo, undoing, undoEdit };
};
