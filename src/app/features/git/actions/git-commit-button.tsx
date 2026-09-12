import type { GitCommitFormState } from '@/app/features/git/hooks';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { failingCheckNames } from '@/app/utils/check-status';
import { Button, Stamp, Tooltip } from '@dendelion/paper-ui';
import { useMemo } from 'react';

interface GitCommitButtonProps {
  state: GitCommitFormState;
  filesEmpty: boolean;
}

// Never Fix (plan-scoped, and the git page never has one) — a failing check is a warning instead.
export const GitCommitButton = ({ state, filesEmpty }: GitCommitButtonProps) => {
  const { checks: deskChecks } = useDeskChecks();
  const failingChecks = useMemo(() => failingCheckNames(deskChecks), [deskChecks]);

  const commitButton = (
    <Button
      size="small"
      disabled={filesEmpty || !state.commitTitle.trim() || state.committing || state.commitInFlight}
      onClick={state.handleCommit}
    >
      {state.committing || state.commitInFlight
        ? 'Committing…'
        : state.stagedCount > 0
          ? `Commit ${state.stagedCount} staged`
          : 'Commit'}
    </Button>
  );

  if (failingChecks.length === 0) return commitButton;

  return (
    <div className="flex items-center gap-2">
      <Tooltip content={`${failingChecks.join(', ')} failing`}>
        <Stamp size="small" variant="warning">
          !
        </Stamp>
      </Tooltip>
      {commitButton}
    </div>
  );
};
