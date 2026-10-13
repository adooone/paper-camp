import { Stamp } from '@dendelion/paper-ui';
import type { ScopeRow } from '../hooks/use-scope';

interface ProjectChipProps {
  project: ScopeRow;
}

/** Names the project a merged row or section belongs to — shown whenever more
 * than one project is in scope (IDEA-291). */
export const ProjectChip = ({ project }: ProjectChipProps) => (
  <Stamp size="small" variant="neutral">
    {project.name}
  </Stamp>
);
