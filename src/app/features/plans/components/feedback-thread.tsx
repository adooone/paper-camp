import { MoreIcon, NoteIcon } from '@/app/components/icons';
import { CollapsibleText } from '@/app/features/plans/components/collapsible-text';
import type { ThreadMessage, ThreadMessageKind } from '@/types/index';
import {
  Button,
  Card,
  CheckIcon,
  IconButton,
  LightbulbIcon,
  Menu,
  type MenuEntry,
  Spinner,
  Stamp,
  Tooltip,
} from '@dendelion/paper-ui';

export const THREAD_KIND_LABEL: Partial<Record<ThreadMessageKind, string>> = {
  review: 'review',
  note: 'note',
  decision: 'decision',
  question: 'question',
  clarification: 'clarification',
};

export type PromoteTarget = 'decision' | 'log' | 'idea';

interface FeedbackThreadProps {
  messages: ThreadMessage[];
  undo: { commitSha: string } | null;
  undoing: boolean;
  onUndo: () => void;
  /** Only offered on `chat`-kind messages — everything else is already durable. */
  onPromote?: (index: number, target: PromoteTarget) => void;
  promotingIndex?: number | null;
}

export const FeedbackThread = ({
  messages,
  undo,
  undoing,
  onUndo,
  onPromote,
  promotingIndex,
}: FeedbackThreadProps) => (
  <>
    {messages.map((message, i) => {
      const label = THREAD_KIND_LABEL[message.kind];
      const fromAgent = message.from === 'agent';
      const isLast = i === messages.length - 1;
      const promoteItems: MenuEntry[] = [
        {
          id: 'decision',
          label: 'Promote to decision',
          icon: <CheckIcon size={16} />,
          onSelect: () => onPromote?.(i, 'decision'),
        },
        {
          id: 'log',
          label: 'Promote to log',
          icon: <NoteIcon size={16} />,
          onSelect: () => onPromote?.(i, 'log'),
        },
        {
          id: 'idea',
          label: 'Promote to idea',
          icon: <LightbulbIcon size={16} />,
          onSelect: () => onPromote?.(i, 'idea'),
        },
      ];
      return (
        <div
          key={`${message.kind}-${message.date ?? ''}-${i}`}
          className={`flex flex-col gap-1 ${fromAgent ? 'items-start' : 'items-end'}`}
        >
          <div className="max-w-[85%]">
            <Card
              size="small"
              surface="paper"
              texture={fromAgent ? 'kraft' : label ? 'canvas' : 'parchment'}
              shade={fromAgent}
              accent={!fromAgent}
              accentColor={label ? 'rose' : 'blue'}
            >
              <CollapsibleText
                collapsedLines={message.kind === 'chat' ? 1 : 3}
                resetKey={`${message.kind}-${message.date ?? ''}-${i}`}
              >
                {message.text}
              </CollapsibleText>
            </Card>
          </div>
          <div className="flex items-center gap-2">
            {fromAgent && (
              <Stamp size="small" fillColor="rgba(0,0,0,0.06)">
                agent
              </Stamp>
            )}
            {fromAgent && isLast && undo && (
              <Tooltip content="Revert this run's plan edit">
                <Button size="small" variant="ghost" onClick={onUndo} disabled={undoing}>
                  {undoing ? 'Undoing…' : 'Undo'}
                </Button>
              </Tooltip>
            )}
            {message.date && (
              <span className="text-sm font-semibold opacity-[0.45]">{message.date}</span>
            )}
            {label && (
              <Stamp size="small" fillColor="rgba(0,0,0,0.06)">
                {label}
              </Stamp>
            )}
            {onPromote &&
              message.kind === 'chat' &&
              (promotingIndex === i ? (
                <Spinner size="small" label="Promoting…" />
              ) : (
                <Menu
                  align="end"
                  trigger={
                    <IconButton
                      icon={<MoreIcon size={14} />}
                      label="Promote this message"
                      size="small"
                      variant="ghost"
                    />
                  }
                  items={promoteItems}
                />
              ))}
          </div>
        </div>
      );
    })}
  </>
);
