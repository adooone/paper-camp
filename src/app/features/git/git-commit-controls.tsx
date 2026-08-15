import { type CommitFormFile, useCommitForm } from '@/app/hooks/use-commit-form';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import { Button, Stamp, Tooltip } from '@dendelion/paper-ui';
import { useMemo } from 'react';

// Stable across renders, and the same value used before this idea's staging/body
// work — keeps drafts saved under the git page's key from being orphaned.
const GIT_PAGE_FORM_KEY = '__git__';

const matchAnySuggestionTask = () => true;

// No plan on the git page, so this is bare commit mechanics — no phase recording, no Fix.
export const useGitCommitForm = (files: CommitFormFile[]) =>
  useCommitForm(files, {
    formKey: GIT_PAGE_FORM_KEY,
    matchesSuggestionTask: matchAnySuggestionTask,
  });

export type GitCommitFormState = ReturnType<typeof useGitCommitForm>;

// Never Fix (plan-scoped, and the git page never has one) — a failing check is a warning instead.
export const GitCommitButton = ({
  state,
  filesEmpty,
}: {
  state: GitCommitFormState;
  filesEmpty: boolean;
}) => {
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
