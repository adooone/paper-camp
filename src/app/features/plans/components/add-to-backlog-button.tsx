import { AddIdeaModal } from '@/app/components/add-idea-modal';
import { createPlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { IconButton, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

export const AddToBacklogButton = () => {
  const loadPlans = useAppStore((s) => s.loadPlans);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const [open, setOpen] = useState(false);

  // Only a merged-and-left-behind branch is "stale" — a dirty or unpushed feature
  // branch is normal work and must not be nagged to switch to main.
  const isStale = gitBranchHygiene === 'stale-merged';

  const handleAdd = async (idea: { title: string; content?: string; kind: string }) => {
    await createPlan(idea);
    await loadPlans();
    setOpen(false);
  };

  return (
    <>
      <Tooltip content={isStale ? 'Switch to main first' : undefined}>
        <IconButton
          icon={<span>+</span>}
          variant="ghost"
          size="small"
          label={isStale ? 'Switch to main first' : 'Add to backlog'}
          disabled={isStale}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <AddIdeaModal open={open} onClose={() => setOpen(false)} onAdd={handleAdd} />
    </>
  );
};
