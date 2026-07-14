import { AddIdeaModal } from '@/app/components/idea/add-idea-modal';
import { createPlan } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import { IconButton, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

// A checklist glyph — a plan is a phase checklist, distinct from the New-idea
// lightbulb so the two toolbar buttons read differently without hovering.
const PlanChecklistIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
  </svg>
);

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
          icon={<PlanChecklistIcon />}
          variant="ghost"
          size="small"
          label={isStale ? 'Switch to main first' : 'Quick plan'}
          disabled={isStale}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <AddIdeaModal open={open} onClose={() => setOpen(false)} onAdd={handleAdd} />
    </>
  );
};
