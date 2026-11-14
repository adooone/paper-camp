import { DiscussInChatButton } from '@/app/features/chat/views/discuss-in-chat-button';
import { usePromoteThreadMessage } from '@/app/features/plans/hooks';
import type { PlanEntry } from '@/types/index';
import { Card, SectionHeading } from '@dendelion/folk-ui';
import { surface } from '@dendelion/folk-ui/tokens';
import { useState } from 'react';
import { FeedbackThread, type PromoteTarget } from '../components';
import { CreateIdeaModal } from '../modals/create-idea-modal';

export const FeedbackSection = ({ plan }: { plan: PlanEntry }) => {
  const thread = plan.thread ?? [];
  const [ideaPromptIndex, setIdeaPromptIndex] = useState<number | null>(null);
  const { promotingIndex, promoteToDurable, promoteToIdea } = usePromoteThreadMessage(plan);

  const handlePromote = (index: number, target: PromoteTarget) => {
    if (target === 'idea') setIdeaPromptIndex(index);
    else promoteToDurable(index, target);
  };

  const handlePromoteToIdea = async (idea: {
    title: string;
    content?: string;
    kind?: 'idea' | 'note' | 'board';
  }) => {
    if (ideaPromptIndex === null) return;
    if (await promoteToIdea(ideaPromptIndex, idea)) setIdeaPromptIndex(null);
  };

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionHeading as="h3">Feedback</SectionHeading>
        {plan.id && <DiscussInChatButton ideaId={plan.id} />}
      </div>
      <Card size="small" accent accentColor="slate" texture={surface.card}>
        <div className="flex flex-col gap-3">
          {thread.length > 0 ? (
            <FeedbackThread
              messages={thread}
              onPromote={handlePromote}
              promotingIndex={promotingIndex}
            />
          ) : (
            <p className="text-sm m-0 text-ink-500">
              Nothing on this idea's thread yet. Discuss it in chat and Scout records the outcome
              here.
            </p>
          )}
        </div>
      </Card>
      <CreateIdeaModal
        open={ideaPromptIndex !== null}
        onClose={() => setIdeaPromptIndex(null)}
        onAdd={handlePromoteToIdea}
        initialContent={ideaPromptIndex !== null ? thread[ideaPromptIndex]?.text : undefined}
      />
    </div>
  );
};
