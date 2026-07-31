import { postFeedbackMessage } from '@/app/services/agent-api';
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

  const send = async (text: string): Promise<boolean> => {
    if (!plan.id) return false;
    setSending(true);
    try {
      const { error } = await postFeedbackMessage(plan.id, text);
      await loadPlans();
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

  return { sending, send };
};
