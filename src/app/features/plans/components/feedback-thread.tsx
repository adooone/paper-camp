import { CollapsibleText } from '@/app/features/plans/components/collapsible-text';
import { ProjectChip, type ScopeRow } from '@/app/features/scope';
import type { ThreadMessage, ThreadMessageKind } from '@/types/index';
import {
  Card,
  CheckIcon,
  IconButton,
  LightbulbIcon,
  Menu,
  type MenuEntry,
  MoreIcon,
  NoteIcon,
  Spinner,
  Stamp,
} from '@dendelion/folk-ui';
import { colors } from '@dendelion/folk-ui/tokens';

const THREAD_KIND_LABEL: Partial<Record<ThreadMessageKind, string>> = {
  review: 'review',
  note: 'note',
  decision: 'decision',
  question: 'question',
  clarification: 'clarification',
};

export type PromoteTarget = 'decision' | 'log' | 'idea';

interface FeedbackThreadProps {
  messages: ThreadMessage[];
  /** Only offered on `chat`-kind messages — everything else is already durable. */
  onPromote?: (index: number, target: PromoteTarget) => void;
  promotingIndex?: number | null;
  /** Tags every message with the scope project it belongs to, when more than
   * one project is in view (IDEA-291). */
  project?: ScopeRow;
}

export const FeedbackThread = ({
  messages,
  onPromote,
  promotingIndex,
  project,
}: FeedbackThreadProps) => (
  <>
    {messages.map((message, i) => {
      const label = THREAD_KIND_LABEL[message.kind];
      const fromAgent = message.from === 'agent';
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
          icon: <NoteIcon size={16} opacity={0.55} />,
          onSelect: () => onPromote?.(i, 'log'),
        },
        {
          id: 'idea',
          label: 'Promote to idea',
          icon: <LightbulbIcon size={16} opacity={0.55} />,
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
              <Stamp size="small" fillColor={colors.surfaceOverlay}>
                agent
              </Stamp>
            )}
            {project && <ProjectChip project={project} />}
            {message.date && (
              <span className="text-sm font-semibold opacity-[0.45]">{message.date}</span>
            )}
            {label && (
              <Stamp size="small" fillColor={colors.surfaceOverlay}>
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
