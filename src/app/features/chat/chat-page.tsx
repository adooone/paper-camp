import { DoodleIllustration, RowSkeleton } from '@/app/components';
import { Card, EmptyState, PageTitle, Spinner } from '@dendelion/folk-ui';
import { surface } from '@dendelion/folk-ui/tokens';
import { useEffect, useRef } from 'react';
import { useChatPage } from './hooks';
import { ChatComposer, ChatMessage, ChatTitleActions, ClearChatModal } from './views';

export const ChatPage = () => {
  const {
    loading,
    messages,
    pending,
    sending,
    input,
    setInput,
    handleSend,
    handleAnswer,
    unansweredCount,
    confirmOpen,
    openConfirmClear,
    closeConfirmClear,
    handleClear,
    clearing,
    projectOptions,
    targetProject,
    setTargetProjectKey,
    currentScopeRow,
  } = useChatPage();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [loading]);

  const hasChatHistory = messages.length > 0;

  return (
    <div>
      <div className="mb-2 flex flex-nowrap items-center gap-3">
        <PageTitle className="shrink-0">Chat</PageTitle>
        <div className="flex-1" />
        {hasChatHistory && (
          <ChatTitleActions
            unansweredCount={unansweredCount}
            hasChatHistory={hasChatHistory}
            onClearChat={openConfirmClear}
          />
        )}
      </div>

      {loading && !hasChatHistory && <RowSkeleton />}
      {!loading && !hasChatHistory && (
        <EmptyState
          illustration={<DoodleIllustration name="resting-pen" />}
          message="No messages yet."
        />
      )}

      {messages.map(({ message, index, project }) => (
        <ChatMessage
          key={`chat-${project?.key ?? 'own'}-${index}`}
          message={message}
          onAnswer={(text) => handleAnswer(text, project)}
          answering={sending}
          project={project}
        />
      ))}

      {pending && (
        <div className="flex flex-col gap-1 items-end mb-3">
          <div className="max-w-[85%]">
            <Card size="small" surface="paper" texture="parchment" accent accentColor="blue">
              {pending}
            </Card>
          </div>
        </div>
      )}
      {sending && (
        <div className="flex flex-col gap-1 items-start mb-3">
          <Card size="small" texture={surface.nestedCard}>
            <Spinner size="small" label="Agent thinking…" />
          </Card>
        </div>
      )}

      <div ref={bottomRef} />

      <ChatComposer
        input={input}
        setInput={setInput}
        sending={sending}
        onSend={handleSend}
        projectOptions={projectOptions}
        targetProjectKey={targetProject?.key}
        onTargetProjectChange={setTargetProjectKey}
      />

      <ClearChatModal
        open={confirmOpen}
        onClose={closeConfirmClear}
        onConfirm={handleClear}
        confirming={clearing}
        projectName={currentScopeRow?.name}
      />
    </div>
  );
};
