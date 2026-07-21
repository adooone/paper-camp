import { selectGhOk, selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { ListItem, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

interface FixReviewButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

// Unlike other launch buttons, the prompt isn't built here — unresolved review
// threads only exist server-side (a `gh api` call), so the route builds it via buildFixReviewPrompt.
export const FixReviewButton = ({ plan, disabled }: FixReviewButtonProps) => {
  const launchFixReview = useAppStore((s) => s.launchFixReview);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const ghOk = useAppStore(selectGhOk);
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

  const isDisabled = disabled || launching || !plan.id || !hasAgent || !ghOk;
  const hint = !plan.id
    ? 'Plan needs an ID before an agent can run'
    : !ghOk
      ? 'GitHub CLI needs authentication — set up in Settings'
      : !hasAgent
        ? 'No agent CLI found — set up in Settings'
        : undefined;

  return (
    <Tooltip content={hint}>
      <ListItem
        size="small"
        // paper-ui has no flag icon (only CloseIcon, LightbulbIcon, CheckIcon, CopyIcon,
        // PlusIcon, FolderIcon) — raw span is a deliberate fallback, not an oversight.
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
