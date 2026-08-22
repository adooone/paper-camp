import { mountPrefix } from '@/app/services/mount';
import { Button } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon } from '../icons';
import { ProjectIdentityHeader } from './project-identity-header';

export const ProjectSwitcher = () => {
  const navigate = useNavigate();

  // Embedded under a mount prefix there is no hub to switch through: the host
  // app decides which project this is.
  if (mountPrefix !== '') return <ProjectIdentityHeader size="sm" />;

  return (
    <div className="flex items-center gap-3 min-w-0">
      <Button
        variant="ghost"
        size="small"
        className="shrink-0 gap-1.5"
        onClick={() => navigate({ to: '/projects' })}
      >
        <span className="rotate-180">
          <ChevronRightIcon size={12} />
        </span>
        Back to projects
      </Button>
      <ProjectIdentityHeader size="sm" />
    </div>
  );
};
