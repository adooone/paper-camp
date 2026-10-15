import { Button, Stamp } from '@dendelion/folk-ui';

export interface ChatTitleActionsProps {
  unansweredCount: number;
  hasChatHistory: boolean;
  onClearChat: () => void;
}

export const ChatTitleActions = ({
  unansweredCount,
  hasChatHistory,
  onClearChat,
}: ChatTitleActionsProps) => (
  <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
    {unansweredCount > 0 && (
      <Stamp size="small" variant="warning">
        {unansweredCount} unanswered
      </Stamp>
    )}
    {hasChatHistory && (
      <Button
        variant="link"
        size="small"
        className="font-handwritten text-sm opacity-70"
        onClick={onClearChat}
      >
        Clear chat
      </Button>
    )}
  </div>
);
