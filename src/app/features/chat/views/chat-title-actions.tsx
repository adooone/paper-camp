import { Button } from '@dendelion/folk-ui';

export interface ChatTitleActionsProps {
  hasChatHistory: boolean;
  onClearChat: () => void;
}

export const ChatTitleActions = ({ hasChatHistory, onClearChat }: ChatTitleActionsProps) => (
  <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
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
