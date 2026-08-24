import { type CommitFormFile, useCommitForm } from '@/app/hooks/use-commit-form';

// Stable across renders — keeps drafts saved under the git page's key from being orphaned.
const GIT_PAGE_FORM_KEY = '__git__';

const matchAnySuggestionTask = () => true;

// No plan on the git page, so this is bare commit mechanics — no phase recording, no Fix.
export const useGitCommitForm = (files: CommitFormFile[]) =>
  useCommitForm(files, {
    formKey: GIT_PAGE_FORM_KEY,
    matchesSuggestionTask: matchAnySuggestionTask,
  });

export type GitCommitFormState = ReturnType<typeof useGitCommitForm>;
