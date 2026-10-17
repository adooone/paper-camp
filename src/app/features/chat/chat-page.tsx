import { RowSkeleton } from '@/app/components';
import { Button, EmptyState, PageTitle } from '@dendelion/folk-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isNearBottom } from './helpers';
import { useChatPage } from './hooks';
import {
  ChatComposer,
  ChatMessage,
  ChatStageBubble,
  ChatTitleActions,
  ClearChatModal,
} from './views';

const QUICK_PROMPTS = [
  { label: "What's running right now?", fill: "What's running right now?" },
  { label: "What's waiting on me?", fill: "What's waiting on me?" },
  { label: 'File an idea for …', fill: 'File an idea for ' },
];

export const ChatPage = () => {
  const {
    loading,
    messages,
    pending,
    sending,
    chatStage,
    input,
    setInput,
    handleSend,
    handleAnswer,
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

  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const hasScrolledInitially = useRef(false);
  const messageCountRef = useRef(messages.length);
  const [newMessagesPending, setNewMessagesPending] = useState(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    setNewMessagesPending(false);
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      nearBottomRef.current = isNearBottom(el);
      if (nearBottomRef.current) setNewMessagesPending(false);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!hasScrolledInitially.current) {
      hasScrolledInitially.current = true;
      messageCountRef.current = messages.length;
      scrollToBottom();
      return;
    }
    if (messages.length === messageCountRef.current) return;
    messageCountRef.current = messages.length;
    if (nearBottomRef.current) {
      scrollToBottom();
    } else {
      setNewMessagesPending(true);
    }
  }, [loading, messages.length, scrollToBottom]);

  const fillComposer = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const onSend = async () => {
    await handleSend();
    textareaRef.current?.focus();
  };

  const hasChatHistory = messages.length > 0;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="mb-2 flex flex-nowrap items-center gap-3 shrink-0">
        <PageTitle className="shrink-0">Scout</PageTitle>
        <div className="flex-1" />
        {hasChatHistory && (
          <ChatTitleActions hasChatHistory={hasChatHistory} onClearChat={openConfirmClear} />
        )}
      </div>

      <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto">
        {loading && !hasChatHistory && <RowSkeleton />}
        {!loading && !hasChatHistory && (
          <EmptyState
            message="Hi — I'm Scout. Tell me about work and I'll file it as an idea, mention an idea and I'll post there, or ask what's running."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt.label}
                    variant="ghost"
                    size="small"
                    onClick={() => fillComposer(prompt.fill)}
                  >
                    {prompt.label}
                  </Button>
                ))}
              </div>
            }
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
          <ChatMessage
            message={pending.message}
            onAnswer={async () => false}
            project={pending.project}
          />
        )}
        {sending && chatStage && <ChatStageBubble stage={chatStage} />}

        <div ref={bottomRef} />
      </div>

      {newMessagesPending && (
        <div className="relative flex justify-center shrink-0">
          <Button
            variant="secondary"
            size="small"
            className="absolute -top-10"
            onClick={scrollToBottom}
          >
            New messages
          </Button>
        </div>
      )}

      <div className="shrink-0">
        <ChatComposer
          input={input}
          setInput={setInput}
          sending={sending}
          onSend={onSend}
          textareaRef={textareaRef}
          projectOptions={projectOptions}
          targetProjectKey={targetProject?.key}
          onTargetProjectChange={setTargetProjectKey}
        />
      </div>

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
