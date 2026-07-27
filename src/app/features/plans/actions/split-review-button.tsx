import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { Button, Tooltip } from '@dendelion/paper-ui';

interface SplitReviewButtonProps {
  planId: string | undefined;
  hasPoints: boolean;
  launching: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const SplitReviewButton = ({
  planId,
  hasPoints,
  launching,
  onClick,
  disabled,
}: SplitReviewButtonProps) => {
  const hasAgent = useAppStore(selectHasAnyAgent);

  const hint = !planId
    ? 'Needs an ID before an agent can run'
    : !hasPoints
      ? 'Add a review point first — this proposes rework phases or a follow-up idea for each'
      : !hasAgent
        ? 'No agent CLI found — set up in Settings'
        : 'Split each review point into rework or a follow-up idea';

  return (
    <Tooltip content={hint}>
      <Button
        variant="secondary"
        size="small"
        onClick={onClick}
        disabled={disabled || launching || !planId || !hasAgent || !hasPoints}
      >
        {launching ? 'Splitting…' : 'Split review'}
      </Button>
    </Tooltip>
  );
};
