import { Button, Card, Spinner, Stamp, Textarea } from '@dendelion/folk-ui';
import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { type ChatTurnInfo, chatStageLine } from '@/app/features/chat/hooks/use-chat-stage';
import type { OpenQuestionGroup } from '@/app/features/plans/helpers';
import { useChatClient } from '@/app/hooks/use-chat-client';
import type { PlanEntry, ThreadMessage } from '@/types/index';

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  height: '100%',
  minHeight: 0,
};

const questionCountStyle: CSSProperties = {
  opacity: 0.6,
  fontSize: '0.75rem',
};

const threadStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const emptyThreadStyle: CSSProperties = {
  opacity: 0.6,
  fontSize: '0.75rem',
};

const bubbleColumnStyle = (fromAgent: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  alignItems: fromAgent ? 'flex-start' : 'flex-end',
});

const bubbleWrapStyle: CSSProperties = { maxWidth: '85%' };

const bubbleTextStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  whiteSpace: 'pre-wrap',
};

const bubbleMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  fontSize: '0.6875rem',
  opacity: 0.6,
};

const footerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.5rem',
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.5rem',
  flexShrink: 0,
};

const replyBoxStyle: CSSProperties = { flexShrink: 0 };
const errorRowStyle: CSSProperties = { marginTop: '0.375rem' };

const Bubble = ({ text, fromAgent, date }: { text: string; fromAgent: boolean; date?: string }) => (
  <div style={bubbleColumnStyle(fromAgent)}>
    <div style={bubbleWrapStyle}>
      <Card size="small">
        <span style={bubbleTextStyle}>{text}</span>
      </Card>
    </div>
    {(fromAgent || date) && (
      <div style={bubbleMetaStyle}>
        {fromAgent && <Stamp size="small">agent</Stamp>}
        {date && <span>{date}</span>}
      </div>
    )}
  </div>
);

const ThreadMessages = ({
  messages,
  turn,
}: {
  messages: ThreadMessage[];
  turn: ChatTurnInfo | null;
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamedLength = (turn?.text.length ?? 0) + (turn?.tools.length ?? 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length and streamedLength are the rescroll triggers, not read in the body.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, streamedLength]);

  if (messages.length === 0 && !turn) {
    return <span style={emptyThreadStyle}>No messages yet — ask Scout anything.</span>;
  }

  return (
    <>
      {messages.map((message, i) => (
        <Bubble
          key={`${message.kind}-${message.date ?? ''}-${i}`}
          text={message.text}
          fromAgent={message.from === 'agent'}
          date={message.date}
        />
      ))}
      {turn?.text && <Bubble text={turn.text} fromAgent />}
      <div ref={bottomRef} />
    </>
  );
};

export interface ScoutThreadProps {
  focusPlan: PlanEntry | null;
  openQuestions: OpenQuestionGroup[];
  onRefresh: () => void;
}

export const ScoutThread = ({ focusPlan, openQuestions, onRefresh }: ScoutThreadProps) => {
  const [oldest] = openQuestions;
  const discussId = oldest?.plan.id ?? focusPlan?.id;
  const chat = useChatClient(focusPlan?.id);
  const questionCount = openQuestions.reduce((sum, group) => sum + group.questions.length, 0);
  const busy = chat.sending || Boolean(chat.turn?.live);

  const handleSend = async () => {
    await chat.send();
    onRefresh();
  };

  return (
    <div style={rootStyle}>
      {(questionCount > 0 || discussId) && (
        <div style={headerRowStyle}>
          <span style={questionCountStyle}>
            {questionCount > 0 ? `${questionCount} open question(s)` : ''}
          </span>
          {discussId && (
            <Button size="tiny" variant="ghost" onClick={() => chat.prefill(discussId)}>
              Discuss {discussId} in chat
            </Button>
          )}
        </div>
      )}
      <div style={threadStyle}>
        <ThreadMessages messages={chat.thread} turn={chat.turn} />
      </div>
      <div style={replyBoxStyle}>
        <Textarea
          value={chat.input}
          onChange={(e) => chat.setInput(e.target.value)}
          aria-label="Message Scout"
          placeholder="Ask Scout, or name an idea (IDEA-N: …) to act on it…"
          rows={2}
        />
        <div style={footerRowStyle}>
          {chat.turn?.live && chat.turn.stage ? (
            <Spinner
              size="small"
              label={chatStageLine(chat.turn.stage, chat.turn.elapsedSeconds)}
            />
          ) : (
            <span />
          )}
          <Button size="small" onClick={handleSend} disabled={busy || !chat.input.trim()}>
            Send
          </Button>
        </div>
        {chat.error && (
          <div style={errorRowStyle}>
            <Stamp size="small" variant="error">
              {chat.error}
            </Stamp>
          </div>
        )}
      </div>
    </div>
  );
};
