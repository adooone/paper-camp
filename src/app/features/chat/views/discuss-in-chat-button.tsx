import { Button } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';

export const DiscussInChatButton = ({ ideaId }: { ideaId: string }) => {
  const navigate = useNavigate();
  return (
    <Button
      size="small"
      variant="ghost"
      onClick={() => navigate({ to: '/chat', search: { about: ideaId } })}
    >
      Discuss in chat
    </Button>
  );
};
