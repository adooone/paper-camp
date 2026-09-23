import { Button, Stamp } from '@dendelion/paper-ui';

export interface ChatTitleActionsProps {
  unansweredCount: number;
  onClearChat: () => void;
}

export const ChatTitleActions = ({ unansweredCount, onClearChat }: ChatTitleActionsProps) => (
  <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
    {unansweredCount > 0 && (
      <Stamp size="small" variant="warning">
        {unansweredCount} unanswered
      </Stamp>
    )}
    <Button variant="link" size="small" onClick={onClearChat}>
      Clear chat
    </Button>
  </div>
);
