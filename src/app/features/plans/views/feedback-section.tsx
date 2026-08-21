import { useFeedbackComposer } from '@/app/features/plans/hooks';
import type { PlanEntry } from '@/types/index';
import { Button, Card, Spinner, Textarea } from '@dendelion/paper-ui';
import { FeedbackThread } from '../components';
import { CreateIdeaModal } from '../modals/create-idea-modal';

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

interface FeedbackSectionProps {
  plan: PlanEntry;
  updating: boolean;
  onSend: (text: string) => Promise<boolean>;
  undo: { commitSha: string } | null;
  undoing: boolean;
  onUndo: () => void;
}

export const FeedbackSection = ({
  plan,
  updating,
  onSend,
  undo,
  undoing,
  onUndo,
}: FeedbackSectionProps) => {
  const {
    thread,
    input,
    setInput,
    pending,
    promotingIndex,
    ideaPromptIndex,
    handleSend,
    handlePromote,
    handlePromoteToIdea,
    closeIdeaPrompt,
  } = useFeedbackComposer(plan, onSend);

  return (
    <div className="mb-8">
      <h3 className={`${sectionHeadingClass} mb-3`}>Feedback</h3>
      <Card size="small" accent accentColor="slate" texture="kraft">
        <div className="flex flex-col gap-3 mb-4">
          {thread.length > 0 || pending ? (
            <>
              <FeedbackThread
                messages={thread}
                undo={undo}
                undoing={undoing}
                onUndo={onUndo}
                onPromote={handlePromote}
                promotingIndex={promotingIndex}
              />
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
              {updating && (
                <div className="flex flex-col gap-1 items-start">
                  <Card size="small" surface="paper" texture="kraft" shade>
                    <Spinner size="small" label="Agent thinking…" />
                  </Card>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm m-0 text-ink-500">
              Jot a comment, ask a question, or say what's wrong with this plan.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Feedback message"
            placeholder="Write a message…"
            rows={3}
          />
          <div className="flex justify-end items-center gap-3">
            <Button size="small" onClick={handleSend} disabled={updating || !input.trim()}>
              Send
            </Button>
          </div>
        </div>
      </Card>
      <CreateIdeaModal
        open={ideaPromptIndex !== null}
        onClose={closeIdeaPrompt}
        onAdd={handlePromoteToIdea}
        initialContent={ideaPromptIndex !== null ? thread[ideaPromptIndex]?.text : undefined}
      />
    </div>
  );
};
