import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { ListItem, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

interface FixReviewButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

// IDEA-57 phase 4: unlike every other launch button, the prompt isn't built here —
// the unresolved review threads only exist server-side (a `gh api` call), so the
// route itself fetches them and builds the prompt via buildFixReviewPrompt.
export const FixReviewButton = ({ plan, disabled }: FixReviewButtonProps) => {
  const launchFixReview = useAppStore((s) => s.launchFixReview);
  const [launching, setLaunching] = useState(false);

  const handleClick = async () => {
    if (!plan.id) return;
    setLaunching(true);
    try {
      await launchFixReview(plan.id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  const isDisabled = disabled || launching || !plan.id;

  return (
    <Tooltip content={plan.id ? undefined : 'Plan needs an ID before an agent can run'}>
      <ListItem
        size="small"
        icon={<span style={{ color: color.accentAmberDark }}>⚑</span>}
        onClick={handleClick}
        disabled={isDisabled}
        style={isDisabled ? { opacity: 0.5 } : undefined}
      >
        {launching ? 'Starting…' : 'Fix review comments'}
      </ListItem>
    </Tooltip>
  );
};
