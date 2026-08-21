import { hasCompletedPhase } from '@/app/features/plans/helpers';
import type { PhaseItem, PlanEntry } from '@/types/index';
import { Button, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';
import { buildStylePassPhase } from '../prompts';

interface StylePassButtonProps {
  plan: PlanEntry;
  onAdd: (phases: PhaseItem[]) => Promise<void>;
  disabled?: boolean;
}

export const StylePassButton = ({ plan, onAdd, disabled }: StylePassButtonProps) => {
  const [adding, setAdding] = useState(false);

  const handleClick = async () => {
    setAdding(true);
    try {
      await onAdd([buildStylePassPhase()]);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Tooltip content="Append a style pass against docs/CODE_STYLE.md as a phase">
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={disabled || adding || !hasCompletedPhase(plan)}
      >
        Style pass
      </Button>
    </Tooltip>
  );
};
