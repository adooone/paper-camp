import { Alert, IconButton, Input, Textarea } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { WandIcon } from './icons';

export interface CommitMessageFieldsState {
  commitTitle: string;
  setCommitTitle: (value: string) => void;
  commitMessage: string;
  setCommitMessage: (value: string) => void;
  suggesting: boolean;
  suggestError: string | null;
  setSuggestError: (error: string | null) => void;
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
  const [bodyExpanded, setBodyExpanded] = useState(Boolean(state.commitMessage));

  useEffect(() => {
    if (state.commitMessage) setBodyExpanded(true);
  }, [state.commitMessage]);

  return (
    <div className="flex flex-col gap-2">
      {state.suggestError && (
        <Alert dismissible onDismiss={() => state.setSuggestError(null)}>
          {state.suggestError}
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
      {bodyExpanded ? (
        <Textarea
          size="small"
          placeholder="Commit message (optional)"
          value={state.commitMessage}
          onChange={(e) => state.setCommitMessage(e.currentTarget.value)}
        />
      ) : (
        // Raw <button>: paper-ui's Button has no bare text-link variant.
        <button
          type="button"
          onClick={() => setBodyExpanded(true)}
          className="self-start bg-none bg-transparent border-none p-0 [font:inherit] text-2xs opacity-60 cursor-pointer underline"
        >
          Add a message
        </button>
      )}
    </div>
  );
};
