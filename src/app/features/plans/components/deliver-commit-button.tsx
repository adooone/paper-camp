import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { Button } from '@dendelion/paper-ui';
import { useMemo } from 'react';
import type { DeliverCommitFormState } from '../hooks';

interface CommitActionButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
}

const CommitActionButton = ({ label, disabled, onClick }: CommitActionButtonProps) => (
  <Button size="small" disabled={disabled} onClick={onClick}>
    {label}
  </Button>
);

// Becomes Fix on a failing check — a plan always exists here, unlike the git page's GitCommitButton.
interface DeliverCommitButtonProps {
  state: DeliverCommitFormState;
  filesEmpty: boolean;
}

export const DeliverCommitButton = ({ state, filesEmpty }: DeliverCommitButtonProps) => {
  const status = useAppStore((s) => s.status);
  const { checks: deskChecks } = useDeskChecks();
  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(status, deskChecks),
    [status, deskChecks],
  );
  const checksFailing =
    qualityStatus === 'fail' || testStatus === 'fail' || consistencyStatus === 'fail';

  if (checksFailing) {
    const label = state.fixing ? 'Fixing…' : 'Fix';
    return (
      <CommitActionButton
        label={label}
        disabled={!state.canFix || state.fixing}
        onClick={state.handleFix}
      />
    );
  }

  const committing = state.committing || state.commitInFlight;
  const label = committing
    ? 'Committing…'
    : state.stagedCount > 0
      ? `Commit ${state.stagedCount} staged`
      : 'Commit';

  return (
    <CommitActionButton
      label={label}
      disabled={filesEmpty || !state.commitTitle.trim() || committing}
      onClick={state.handleCommit}
    />
  );
};
