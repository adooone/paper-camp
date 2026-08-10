import type { OpenQuestionGroup } from '@/app/features/plans/helpers';
import { useSendFeedbackMessage } from '@/app/features/plans/hooks';
import type { PlanEntry, ThreadMessage } from '@/types/index';
import { Button, Card, Spinner, Stamp, Textarea } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  minHeight: 0,
};

const questionCountStyle: CSSProperties = {
  opacity: 0.6,
  fontSize: '0.75rem',
};

const threadStyle: CSSProperties = {
  maxHeight: '22rem',
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

const errorRowStyle: CSSProperties = { marginTop: '0.375rem' };
const emptyStateStyle: CSSProperties = { opacity: 0.6, fontSize: '0.75rem' };

const noopReload = async () => {};

const ThreadMessages = ({ messages }: { messages: ThreadMessage[] }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length is the rescroll trigger, not read in the body.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (messages.length === 0) {
    return <span style={emptyThreadStyle}>No messages yet — say hello.</span>;
  }

  return (
    <>
      {messages.map((message, i) => {
        const fromAgent = message.from === 'agent';
        return (
          <div
            key={`${message.kind}-${message.date ?? ''}-${i}`}
            style={bubbleColumnStyle(fromAgent)}
          >
            <div style={bubbleWrapStyle}>
              <Card size="small">
                <span style={bubbleTextStyle}>{message.text}</span>
              </Card>
            </div>
            <div style={bubbleMetaStyle}>
              {fromAgent && <Stamp size="small">agent</Stamp>}
              {message.date && <span>{message.date}</span>}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </>
  );
};

const ReplyBox = ({
  plan,
  placeholder,
  onSent,
}: {
  plan: PlanEntry;
  placeholder: string;
  onSent: () => void;
}) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  // No <ToastProvider> inside the toolbar's shadow DOM (its portal would render
  // unstyled in the host page), so failures surface inline here instead.
  const { sending, send } = useSendFeedbackMessage(plan, {
    reload: noopReload,
    notify: (options) => setError(options.title ?? 'Something went wrong'),
  });

  const handleSend = async () => {
    setError(null);
    if (!input.trim()) return;
    if (await send(input.trim())) {
      setInput('');
      onSent();
    }
  };

  return (
    <div>
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label={`Reply to ${plan.title}`}
        placeholder={placeholder}
        rows={2}
        disabled={sending}
      />
      <div style={footerRowStyle}>
        {sending ? <Spinner size="small" label="Scout replying…" /> : <span />}
        <Button size="small" onClick={handleSend} disabled={sending || !input.trim()}>
          Send
        </Button>
      </div>
      {error && (
        <div style={errorRowStyle}>
          <Stamp size="small" variant="error">
            {error}
          </Stamp>
        </div>
      )}
    </div>
  );
};

export interface ScoutThreadProps {
  focusPlan: PlanEntry | null;
  openQuestions: OpenQuestionGroup[];
  onRefresh: () => void;
}

export const ScoutThread = ({ focusPlan, openQuestions, onRefresh }: ScoutThreadProps) => {
  const [oldest] = openQuestions;
  const activePlan = oldest?.plan ?? focusPlan;

  if (!activePlan) {
    return (
      <div style={rootStyle}>
        <span style={emptyStateStyle}>No active idea and no open questions.</span>
      </div>
    );
  }

  const remainingQuestionCount = oldest
    ? openQuestions.reduce((sum, group) => sum + group.questions.length, 0) - 1
    : 0;

  return (
    <div style={rootStyle}>
      {remainingQuestionCount > 0 && (
        <span style={questionCountStyle}>{remainingQuestionCount} more open question(s)</span>
      )}
      <div style={threadStyle}>
        <ThreadMessages messages={activePlan.thread ?? []} />
      </div>
      <ReplyBox
        plan={activePlan}
        placeholder={
          oldest
            ? 'Reply to resolve and resume…'
            : 'Ask Scout, jot a note, or say “note this down as an idea”…'
        }
        onSent={onRefresh}
      />
    </div>
  );
};
