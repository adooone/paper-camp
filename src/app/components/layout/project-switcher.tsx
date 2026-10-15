import { useProjectIdentity } from '@/app/hooks';
import { mountPrefix } from '@/app/services/mount';
import { ProjectSwitcherMenu } from './project-switcher-menu';

// Under a mount the host app decides the project, so it's named without a menu.
const ProjectName = () => {
  const { projectName } = useProjectIdentity();
  return (
    <span className="truncate pr-1 font-handwritten text-base leading-normal">{projectName}</span>
  );
};

export const ProjectSwitcher = () =>
  mountPrefix !== '' ? <ProjectName /> : <ProjectSwitcherMenu />;
