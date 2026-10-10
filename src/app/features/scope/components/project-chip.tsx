import { Stamp } from '@dendelion/paper-ui';
import type { ScopeRow } from '../hooks/use-scope';
import { DOT_CLASS } from './dot-class';

interface ProjectChipProps {
  project: ScopeRow;
}

/** Names the project a merged row or section belongs to — shown whenever more
 * than one project is in scope (IDEA-291). */
export const ProjectChip = ({ project }: ProjectChipProps) => (
  <Stamp size="small" variant="neutral">
    <span
      className={`-ml-0.5 mr-1 inline-block h-1.5 w-1.5 rounded-full ${DOT_CLASS[project.color]}`}
    />
    {project.name}
  </Stamp>
);
