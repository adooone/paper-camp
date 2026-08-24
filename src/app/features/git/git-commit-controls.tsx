import type { GitCommitFormState } from '@/app/features/git/hooks';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { Button, Stamp, Tooltip } from '@dendelion/paper-ui';
import { useMemo } from 'react';

interface GitCommitButtonProps {
  state: GitCommitFormState;
  filesEmpty: boolean;
}

// Never Fix (plan-scoped, and the git page never has one) — a failing check is a warning instead.
export const GitCommitButton = ({ state, filesEmpty }: GitCommitButtonProps) => {
  const status = useAppStore((s) => s.status);
  const { checks: deskChecks } = useDeskChecks();
  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(status, deskChecks),
    [status, deskChecks],
  );
  const failingChecks = [
    qualityStatus === 'fail' && 'Quality',
    testStatus === 'fail' && 'Tests',
    consistencyStatus === 'fail' && 'Consistency',
  ].filter((label): label is Exclude<typeof label, false> => label !== false);

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
