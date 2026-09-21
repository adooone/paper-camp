import { mountPrefix } from '@/app/services/mount';
import { Button } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { ProjectIdentityHeader } from './project-identity-header';

export const ProjectSwitcher = () => {
  const navigate = useNavigate();

  // Embedded under a mount prefix there is no hub to switch through: the host
  // app decides which project this is.
  if (mountPrefix !== '') return <ProjectIdentityHeader size="sm" />;

  return (
    <div className="flex shrink-0 items-center gap-3">
      <ProjectIdentityHeader size="sm" />
      <Button
        variant="ghost"
        size="small"
        className="whitespace-nowrap font-handwritten !text-sm opacity-70"
        onClick={() => navigate({ to: '/projects' })}
      >
        <span className="sm:hidden">Projects</span>
        <span className="hidden sm:inline">Back to projects</span>
      </Button>
    </div>
  );
};
