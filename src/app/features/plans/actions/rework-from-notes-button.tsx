import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, Tooltip, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { openMarginNotes } from '../helpers';
import { buildReworkFromNotesPrompt } from '../prompts';

interface ReworkFromNotesButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

/**
 * Turns anchored margin notes into real changes, the counterpart to Refresh
 * (reconcile), which deliberately never reads them. Snapshot and completion live in
 * the store, so the before/after preview still appears if this button unmounts.
 */
export const ReworkFromNotesButton = ({ plan, disabled }: ReworkFromNotesButtonProps) => {
  const launchPlanRework = useAppStore((s) => s.launchPlanRework);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);

  const notes = openMarginNotes(plan.notes);

  const handleClick = async () => {
    if (!plan.id || notes.length === 0) return;
    setLaunching(true);
    try {
      await launchPlanRework(
        plan.id,
        buildReworkFromNotesPrompt(plan, notes),
        { body: plan.body, phases: plan.phases },
        notes,
      );
      toast({
        title: 'Reworking from your notes',
        description: 'The agent is reworking this entry — you can approve or discard the result.',
      });
    } catch (err) {
      toast({
        title: 'Could not rework from notes',
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
      ? 'Add a margin note first — this turns open notes into phases and edits'
      : !hasAgent
        ? 'No agent CLI found — set up in Settings'
        : 'Rework this entry from your open margin notes';

  return (
    <Tooltip content={hint}>
      <Button
        variant="secondary"
        size="small"
        onClick={handleClick}
        disabled={disabled || launching || !plan.id || !hasAgent || notes.length === 0}
      >
        {launching ? 'Reworking…' : 'Rework from my notes'}
      </Button>
    </Tooltip>
  );
};
