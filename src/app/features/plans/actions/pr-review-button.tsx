import { GithubIcon } from '@/app/components/icons';
import { SidebarCommand } from '@/app/components/sidebar';
import { usePrReviewStatus } from '@/app/hooks/use-pr-review-status';
import { selectGhOk, selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Tooltip } from '@dendelion/paper-ui';
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
  const label = alreadyReviewed
    ? `Review again — last reviewed at ${(status?.lastReviewedSha ?? '').slice(0, 7)}`
    : 'Review PR';
  const advisories = [
    status && !status.ready && 'draft',
    status?.ciGreen === false && 'CI not green',
  ].filter(Boolean);

  return (
    <Tooltip content={hint}>
      <SidebarCommand
        icon={<GithubIcon size={16} />}
        onClick={handleClick}
        disabled={disabled || !plan.id || !hasAgent || !ghOk}
        busy={launching ? 'Starting…' : undefined}
        note={advisories.length > 0 ? advisories.join(' · ') : undefined}
      >
        {label}
      </SidebarCommand>
    </Tooltip>
  );
};
