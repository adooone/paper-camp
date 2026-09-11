import { RowSkeleton } from '@/app/components';
import { PageTitle } from '@/app/components/page-title';
import { FeedbackThread } from '@/app/features/plans/components';
import { Button, Card, Spinner, Textarea } from '@dendelion/paper-ui';
import { useChatPage } from './hooks/use-chat-page';
import { ChatTitleActions, ClearChatModal } from './views';

export const ChatPage = () => {
  const {
    thread,
    loading,
    input,
    setInput,
    pending,
    sending,
    handleSend,
    unansweredCount,
    confirmOpen,
    openConfirmClear,
    closeConfirmClear,
    handleClear,
    clearing,
  } = useChatPage();

  return (
    <div>
      <div className="mb-2 flex flex-nowrap items-center gap-3">
        <PageTitle className="mb-0 shrink-0">Chat</PageTitle>
        <div className="flex-1" />
        {thread.length > 0 && (
          <ChatTitleActions unansweredCount={unansweredCount} onClearChat={openConfirmClear} />
        )}
      </div>
      {loading && thread.length === 0 ? (
        <RowSkeleton />
      ) : (
        <Card size="small" accent accentColor="slate" texture="kraft">
          <div className="flex flex-col gap-3 mb-4">
            {thread.length > 0 || pending ? (
              <>
                <FeedbackThread messages={thread} undo={null} undoing={false} onUndo={() => {}} />
                {pending && (
                  <div className="flex flex-col gap-1 items-end">
                    <div className="max-w-[85%]">
                      <Card
                        size="small"
                        surface="paper"
                        texture="parchment"
                        accent
                        accentColor="blue"
                      >
                        {pending}
                      </Card>
                    </div>
                  </div>
                )}
                {sending && (
                  <div className="flex flex-col gap-1 items-start">
                    <Card size="small" surface="paper" texture="kraft" shade>
                      <Spinner size="small" label="Agent thinking…" />
                    </Card>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm m-0 text-ink-500">
                Ask about the project, report something broken, or say what to build next.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Chat message"
              placeholder="Write a message…"
              rows={3}
            />
            <div className="flex justify-end items-center gap-3">
              <Button size="small" onClick={handleSend} disabled={sending || !input.trim()}>
                Send
              </Button>
            </div>
          </div>
        </Card>
      )}
      <ClearChatModal
        open={confirmOpen}
        onClose={closeConfirmClear}
        onConfirm={handleClear}
        confirming={clearing}
      />
    </div>
  );
};
