import { useNavigate } from '@tanstack/react-router';
import { useIdeaScreen } from '../hooks/use-idea-screen';
import { IdeaView } from '../idea/idea-view';
import { SCREEN_PATHS } from '../shell/screens';
import { EmptyState } from '../ui/empty-state';
import { SkeletonRows } from '../ui/skeleton-rows';

interface IdeaColumnProps {
  ideaId: string | undefined;
  onBack?: () => void;
}

function IdeaScreen({ ideaId, onBack }: { ideaId: string; onBack?: () => void }) {
  const screen = useIdeaScreen(ideaId);
  const navigate = useNavigate();
  const discuss = () => void navigate({ to: SCREEN_PATHS.chat, search: { about: ideaId } });
  if (screen.load === 'loading') return <SkeletonRows />;
  if (screen.load === 'failed') {
    return (
      <EmptyState
        title="Couldn't load this idea"
        line={`${ideaId} did not come back from this project.`}
        actionLabel={onBack ? 'Back to ideas' : undefined}
        onAction={onBack}
      />
    );
  }
  return <IdeaView screen={screen} onBack={onBack} onDiscuss={discuss} />;
}

export function IdeaColumn({ ideaId, onBack }: IdeaColumnProps) {
  if (!ideaId) {
    return <EmptyState title="Pick an idea" line="Its plan, phases and thread open here." />;
  }
  return <IdeaScreen key={ideaId} ideaId={ideaId} onBack={onBack} />;
}
