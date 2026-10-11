import { DoodleIllustration, RowSkeleton } from '@/app/components';
import { FeedbackThread } from '@/app/features/plans/components';
import { Card, EmptyState, PageTitle, Spinner } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import { useEffect, useRef } from 'react';
import { useChatThread } from './hooks';
import { ChatComposer, ChatTitleActions, ClearChatModal } from './views';

export const ChatPage = () => {
  const chat = useChatThread();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chat.loading) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.loading]);

  const hasChatHistory = chat.thread.length > 0;

  return (
    <div>
      <div className="mb-2 flex flex-nowrap items-center gap-3">
        <PageTitle className="shrink-0">Chat</PageTitle>
        <div className="flex-1" />
        {hasChatHistory && (
          <ChatTitleActions
            unansweredCount={chat.unansweredCount}
            hasChatHistory={hasChatHistory}
            onClearChat={chat.openConfirmClear}
          />
        )}
      </div>

      {chat.loading && !hasChatHistory && <RowSkeleton />}
      {!chat.loading && !hasChatHistory && (
        <EmptyState
          illustration={<DoodleIllustration name="resting-pen" />}
          message="No messages yet."
        />
      )}

      {hasChatHistory && (
        <FeedbackThread
          messages={chat.thread}
          undo={null}
          undoing={false}
          onUndo={() => {}}
          onAnswer={chat.handleAnswer}
          answering={chat.sending}
        />
      )}

      {chat.pending && (
        <div className="flex flex-col gap-1 items-end mb-3">
          <div className="max-w-[85%]">
            <Card size="small" surface="paper" texture="parchment" accent accentColor="blue">
              {chat.pending}
            </Card>
          </div>
        </div>
      )}
      {chat.sending && (
        <div className="flex flex-col gap-1 items-start mb-3">
          <Card size="small" texture={surface.nestedCard}>
            <Spinner size="small" label="Agent thinking…" />
          </Card>
        </div>
      )}

      <div ref={bottomRef} />

      <ChatComposer
        input={chat.input}
        setInput={chat.setInput}
        sending={chat.sending}
        onSend={() => chat.handleSend()}
      />

      <ClearChatModal
        open={chat.confirmOpen}
        onClose={chat.closeConfirmClear}
        onConfirm={chat.handleClear}
        confirming={chat.clearing}
      />
    </div>
  );
};
