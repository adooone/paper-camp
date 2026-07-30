import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, Tooltip, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { buildReworkPrompt } from '../prompts';

interface ApplyNotesButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

/**
 * Turns the comments on an entity into real changes — the counterpart to Refresh
 * (reconcile), which deliberately never reads them. Snapshot and completion live in
 * the store, so the before/after preview still appears if this button unmounts.
 */
export const ApplyNotesButton = ({ plan, disabled }: ApplyNotesButtonProps) => {
  const launchPlanRework = useAppStore((s) => s.launchPlanRework);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);

  const notes = plan.log ?? [];

  const handleClick = async () => {
    if (!plan.id || notes.length === 0) return;
    setLaunching(true);
    try {
      await launchPlanRework(plan.id, buildReworkPrompt(plan, notes), {
        body: plan.body,
        phases: plan.phases,
      });
      toast({
        title: 'Applying your notes',
        description: 'The agent is reworking this entry — you can approve or discard the result.',
      });
    } catch (err) {
      toast({
        title: 'Could not apply notes',
        description: (err as Error).message,
        variant: 'error',
      });
    } finally {
      setLaunching(false);
    }
  };

  const hint = !plan.id
    ? 'Needs an ID before an agent can run'
    : notes.length === 0
      ? 'Add a comment first — this turns your comments into phases and edits'
      : !hasAgent
        ? 'No agent CLI found — set up in Settings'
        : 'Rework this entry from your comments';

  return (
    <Tooltip content={hint}>
      <Button
        size="small"
        onClick={handleClick}
        disabled={disabled || launching || !plan.id || !hasAgent || notes.length === 0}
      >
        {launching ? 'Applying…' : 'Apply notes'}
      </Button>
    </Tooltip>
  );
};
