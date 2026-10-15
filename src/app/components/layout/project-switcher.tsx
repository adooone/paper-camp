import { mountPrefix } from '@/app/services/mount';
import { ProjectIdentityHeader } from './project-identity-header';
import { ProjectSwitcherMenu } from './project-switcher-menu';

export const ProjectSwitcher = () =>
  mountPrefix !== '' ? <ProjectIdentityHeader size="sm" /> : <ProjectSwitcherMenu />;
