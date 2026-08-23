import { postFeedbackMessage, undoFeedbackEdit } from '@/app/services/agent-api';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { MountContext, PlanEntry } from '@/types/index';
import type { ToastOptions } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

export interface SendFeedbackMessageCallbacks {
  /** Refreshes whatever this mount uses to list plans; a toolbar mount whose
   * activity-stream subscription already refetches for it can pass a no-op. */
  reload: () => Promise<void> | void;
  /** paper-ui's `useToast().toast` on the desk — the toolbar lacks `<ToastProvider>`
   * (its portal would escape the shadow DOM), so it supplies its own instead. */
  notify: (options: ToastOptions) => void;
}

/** Posting a feedback message runs a one-shot agent before the reply lands in the
 * thread, so this can't reuse usePlanStatusPatch's plain PATCH-and-reload shape.
 * `reload`/`notify` are injected rather than read from the app store or paper-ui's
 * toast context, so mounts without either (the toolbar — IDEA-130 phase 6) can
 * supply their own. */
export const useSendFeedbackMessage = (
  plan: PlanEntry,
  { reload, notify }: SendFeedbackMessageCallbacks,
) => {
  const [sending, setSending] = useState(false);
  const [undoing, setUndoing] = useState(false);
  // Only the reply this hook instance just received carries an Undo — reloading
  // the page loses it, which is fine for a one-tap "just sent" correction.
  const [undo, setUndo] = useState<{ commitSha: string } | null>(null);

  // A stale undo from the previous plan would otherwise pair with this plan's id.
  // biome-ignore lint/correctness/useExhaustiveDependencies: plan.id is the reset trigger, not read in the body.
  useEffect(() => {
    setUndo(null);
  }, [plan.id]);

  const send = async (text: string): Promise<boolean> => {
    if (!plan.id) return false;
    setSending(true);
    setUndo(null);
    try {
      const context: MountContext = {
        route: window.location.pathname,
        focusedIdeaId: plan.id,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
      const { error, undo: appliedUndo } = await postFeedbackMessage(plan.id, text, context);
      await reload();
      if (appliedUndo) setUndo(appliedUndo);
      if (error) {
        notify({
          title: 'Agent did not reply',
          description: oneLineErrorSummary(error),
          variant: 'error',
        });
      }
      return true;
    } catch (err) {
      notify({
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
        notify({ title: 'Undo failed', description: oneLineErrorSummary(error), variant: 'error' });
        return;
      }
      setUndo(null);
      await reload();
    } catch (err) {
      notify({
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
