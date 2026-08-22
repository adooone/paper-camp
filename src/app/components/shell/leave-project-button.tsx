import { mountPrefix } from '@/app/services/mount';
import { Button } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

export const LeaveProjectButton = () => {
  const navigate = useNavigate();
  // Embedded under a mount prefix there is no hub to go back to: the host app
  // decides which project this is.
  if (mountPrefix !== '') return null;
  return (
    <Button
      variant="ghost"
      size="small"
      className="font-handwritten !text-sm opacity-70"
      onClick={() => navigate({ to: '/projects' })}
    >
      Back to projects
    </Button>
  );
};
