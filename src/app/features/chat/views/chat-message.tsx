import { QuestionCard } from '@/app/features/plans/components/question-card';
import { ProjectChip, type ScopeRow } from '@/app/features/scope';
import type { ThreadMessage } from '@/types/index';
import { Avatar, Card } from '@dendelion/folk-ui';
import { EntityLinkText } from './entity-link-text';

interface ChatMessageProps {
  message: ThreadMessage;
  onAnswer: (text: string) => Promise<boolean>;
  answering?: boolean;
  project?: ScopeRow;
}

function formatMessageTime(date?: string): string | undefined {
  if (!date) return undefined;
  return date.includes('T') ? date.slice(11, 16) : date;
}

const metaLineClass = 'flex items-center gap-2 text-sm font-semibold opacity-[0.45]';

export const ChatMessage = ({
  message,
  onAnswer,
  answering = false,
  project,
}: ChatMessageProps) => {
  const fromAgent = message.from === 'agent';
  const time = formatMessageTime(message.date);

  if (message.kind === 'question') {
    return (
      <div className="flex flex-col gap-1 items-start mb-3">
        <div className="max-w-[85%] flex items-start gap-2">
          <Avatar name="Scout" size="small" />
          <div className="flex flex-col gap-1 min-w-0">
            <div className={metaLineClass}>
              <span>Scout{time ? ` · ${time}` : ''}</span>
              {project && <ProjectChip project={project} />}
            </div>
            <QuestionCard message={message} onAnswer={onAnswer} busy={answering} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 mb-3 ${fromAgent ? 'items-start' : 'items-end'}`}>
      <div className="max-w-[85%] flex items-start gap-2">
        {fromAgent && <Avatar name="Scout" size="small" />}
        <div className="flex flex-col gap-1 min-w-0">
          {(fromAgent || time) && (
            <div className={fromAgent ? metaLineClass : `${metaLineClass} justify-end`}>
              {fromAgent ? (
                <>
                  <span>Scout{time ? ` · ${time}` : ''}</span>
                  {project && <ProjectChip project={project} />}
                </>
              ) : (
                <span>{time}</span>
              )}
            </div>
          )}
          <Card
            size="small"
            surface="paper"
            texture={fromAgent ? 'kraft' : 'parchment'}
            shade={fromAgent}
            accent={!fromAgent}
            accentColor="blue"
          >
            <EntityLinkText text={message.text} />
          </Card>
        </div>
      </div>
    </div>
  );
};
