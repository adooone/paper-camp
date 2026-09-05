import { Alert, IconButton, Input } from '@dendelion/paper-ui';
import { WandIcon } from '../icons';
import { SignInAction } from '../sign-in-action';

export interface CommitMessageFieldsState {
  commitTitle: string;
  setCommitTitle: (value: string) => void;
  commitMessage: string;
  setCommitMessage: (value: string) => void;
  suggesting: boolean;
  suggestError: string | null;
  suggestErrorKind?: 'auth';
  clearSuggestError: () => void;
  handleSuggestFromChanges: () => void;
}

// Identical whether or not the commit is plan-scoped, so it's shared rather than owned per feature.
export const CommitMessageFields = ({
  state,
  filesEmpty,
}: {
  state: CommitMessageFieldsState;
  filesEmpty: boolean;
}) => {
  return (
    <div className="flex flex-col gap-2">
      {state.suggestError && (
        <Alert dismissible onDismiss={state.clearSuggestError}>
          <div className="flex items-center justify-between gap-2">
            <span>{state.suggestError}</span>
            {state.suggestErrorKind === 'auth' && (
              <SignInAction onSignedIn={state.clearSuggestError} />
            )}
          </div>
        </Alert>
      )}
      <div className="flex gap-2 items-center">
        <div className="flex-1 min-w-[140px]">
          <Input
            size="small"
            placeholder="Commit title"
            value={state.commitTitle}
            onChange={(e) => state.setCommitTitle(e.currentTarget.value)}
          />
        </div>
        <IconButton
          icon={<WandIcon size={16} />}
          size="small"
          label="Suggest title and message from the diff"
          disabled={filesEmpty || state.suggesting}
          onClick={state.handleSuggestFromChanges}
          wobble={state.suggesting ? 1 : 0}
        />
      </div>
    </div>
  );
};
