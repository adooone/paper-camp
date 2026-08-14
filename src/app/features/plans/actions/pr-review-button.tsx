import { usePrReviewStatus } from '@/app/hooks/use-pr-review-status';
import { selectGhOk, selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { ListItem, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

interface PrReviewButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

// Like FixReviewButton, the prompt is built server-side — the diff it reviews
// only exists behind a `gh` call, via buildPrReviewPrompt.
export const PrReviewButton = ({ plan, disabled }: PrReviewButtonProps) => {
  const launchPrReview = useAppStore((s) => s.launchPrReview);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const ghOk = useAppStore(selectGhOk);
  const [launching, setLaunching] = useState(false);
  const status = usePrReviewStatus(plan.id);

  const handleClick = async () => {
    if (!plan.id) return;
    setLaunching(true);
    try {
      await launchPrReview(plan.id);
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

  // Nothing here gates the button — a reviewed SHA, a draft PR, or red CI are
  // all still worth a manual re-review, so they're surfaced as a label, not a block.
  const alreadyReviewed = Boolean(
    status?.lastReviewedSha && status.headSha && status.lastReviewedSha === status.headSha,
  );
  const label = launching
    ? 'Starting…'
    : alreadyReviewed
      ? `Review again — last reviewed at ${(status?.lastReviewedSha ?? '').slice(0, 7)}`
      : 'Review PR';
  const advisories = [
    status && !status.ready && 'draft',
    status?.ciGreen === false && 'CI not green',
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-0.5">
      <Tooltip content={hint}>
        <ListItem
          size="small"
          // paper-ui has no eye/magnifier icon — raw span is a deliberate fallback, not an oversight.
          icon={<span className="text-watercolor-blue-dark">◎</span>}
          onClick={handleClick}
          disabled={isDisabled}
          className={`text-xs leading-4 py-2 ${isDisabled ? 'opacity-50' : ''}`}
        >
          {label}
        </ListItem>
      </Tooltip>
      {advisories.length > 0 && (
        <div className="text-2xs text-ink-300 px-2">{advisories.join(' · ')}</div>
      )}
    </div>
  );
};
