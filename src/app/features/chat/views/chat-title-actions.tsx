import { Stamp } from '@dendelion/paper-ui';

export interface ChatTitleActionsProps {
  unansweredCount: number;
  onClearChat: () => void;
}

const linkClass =
  'shrink-0 cursor-pointer border-none bg-transparent p-0 font-handwritten text-sm underline opacity-70 hover:opacity-100';

export const ChatTitleActions = ({ unansweredCount, onClearChat }: ChatTitleActionsProps) => (
  <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
    {unansweredCount > 0 && (
      <Stamp size="small" variant="warning">
        {unansweredCount} unanswered
      </Stamp>
    )}
    <button type="button" className={linkClass} onClick={onClearChat}>
      Clear chat
    </button>
  </div>
);
